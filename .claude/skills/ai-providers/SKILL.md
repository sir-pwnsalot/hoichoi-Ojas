---
name: ai-providers
description: Use when writing or changing lib/ai/llm.ts or lib/ai/image.ts, choosing models for a task, adding fallbacks, handling rate limits, logging AI cost, enforcing the $20 budget cap, or switching to paid tier.
---

# AI providers, routing and budget

## Routing (all model IDs come from env; check the providers' current model lists at build time)
| Purpose | Free tier (default) | Fallback | Premium (`LLM_TIER=premium`) |
|---|---|---|---|
| bn + en copy | Gemini Flash (`GEMINI_MODEL_COPY`), strongest free Bengali | OpenRouter `:free` model | Claude Sonnet via OpenRouter (`OPENROUTER_MODEL_PREMIUM`) |
| Nativeness critic, independence judge | Gemini Flash | OpenRouter free | Claude Sonnet via OpenRouter |
| Creative plan, image prompts, insight extraction (English JSON) | Groq (`GROQ_MODEL_FAST`), fast | Gemini Flash | same as free (cheap enough) |
| Weekly report | Gemini Flash | OpenRouter free | Claude Sonnet via OpenRouter |
| Images | Cloudflare Workers AI `@cf/lykon/dreamshaper-8-lcm` (any model that accepts width/height; never flux-1-schnell, which is 1:1 only) | Pollinations (no key) | Gemini image model (paid) |
| TTS (stretch) | Gemini TTS (free tier) | – | – |
Do not use Groq-hosted models for Bengali generation or judging; their Bengali quality is noticeably weaker.

## `llm.ts` contract
```ts
generateJSON<T>({ purpose, system, user, schema: ZodSchema<T>, temperature? }): Promise<T>
```
- Picks the provider chain by `purpose` and `LLM_TIER`. On 429/5xx/timeout (20 s), falls back to the next provider. On Zod failure, retries once with the validation error appended, then falls back.
- Uses JSON mode where the provider supports it; always strip code fences before parsing.
- Every call writes an `ai_calls` row (provider, model, purpose, tokens, estimated costUsd, ms, ok).
- Gemini, Groq and OpenRouter free calls cost $0, but log tokens anyway so the premium estimate is honest.

## Budget guard ($20 hard cap)
- Before any paid call: `sum(ai_calls.costUsd) + estimate > BUDGET_USD_CAP` → throw `BudgetExceededError` and fall back to the free chain.
- Show the spend meter in the header; warn above `BUDGET_USD_SOFT`.
- Price table in `lib/ai/pricing.ts` (per 1M in/out tokens, per image). Fill in current prices from each provider's pricing page when switching to premium.

## Expected premium spend (rough; verify prices before switching)
| Item | Volume | Est. |
|---|---|---|
| Claude Sonnet copy + critic + report via OpenRouter | ~300 calls × ~3k tokens | ~$4–6 |
| Gemini paid images | ~100 images | ~$4 |
| Buffer for demo-day regenerations | — | ~$5 |
| **Total** | | **≈ $13–15**, under the $20 cap |

## Images (`image.ts`)
```ts
generateImage({ prompt, width, height, seed? }): Promise<{ bytes: Uint8Array; mime; provider; seed }>
```
- Cloudflare: `POST https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/{CF_IMAGE_MODEL}` with the prompt, width, height and steps. SD models return raw image bytes; Flux 2 returns JSON base64. `cfModelSpec()` holds per-model limits.
- Pollinations: `GET https://image.pollinations.ai/prompt/{encoded}?width=&height=&seed=&nologo=true`.
- Round dims to multiples of 8 or 64 as the provider requires, then **the canvas composer outputs the exact target size**. Resizing to exact dims at the *same aspect* is fine; cropping a different-aspect master is not.
- Cache by `hash(prompt, w, h, seed)` in Blob to avoid paying twice.
