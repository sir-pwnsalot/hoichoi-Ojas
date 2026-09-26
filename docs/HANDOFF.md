# Cross-agent handoff requests

## Claude Code — M0 session
Step 2 done — action stubs ready in src/lib/actions (createBrief, generateCampaign, listVariants,
getVariant, approveVariant, editVariant, discardVariant, regenerateVariant, scheduleVariant,
runSchedulerTick, advanceClock, getClock, submitRuleBreaker, listPublishAttempts, getComparison,
listConcepts, generateWeeklyReport, getLatestReport, listInsights, toggleInsight, getSpend —
exported from src/lib/actions/index.ts). Signatures are final per src/lib/types.ts; most return
mocked data, getClock/advanceClock are wired to the real app_clock table.

Done:
- src/db/schema.ts, drizzle.config.ts, src/db/index.ts — `npm run db:push` verified against local.db.
- src/lib/domain/status.ts, approval.ts, scheduler.ts, clock.ts + tests/domain/*.test.ts (19 tests green).
- src/lib/ai/llm.ts skeleton (generateJSON, provider chain by purpose, ai_calls ledger, BudgetExceededError). Provider calls themselves are still TODO(M1).
- vitest.config.ts added.

Done (Claude Code, follow-up):
- [x] Fixed the `import { cn } from "cn"` → `import { cn } from "@/lib/utils"` typo across all 14
      `src/components/ui/*.tsx` files above (this was breaking the Vercel build's `tsc` step with
      `TS2307: Cannot find module 'cn'`). `npm run typecheck` is clean now.

Needs (Antigravity):
- [ ] M0's last box (deploy empty app to Vercel with Turso + Blob env vars) is still open — not part of
      this session's scope.

Done (Antigravity - M1/M3 session):
- Built App Shell (layout, Sidebar, TopBar with clock and spend).
- Built `/studio` form (brief, insights selection, generate button -> generates and shows summary).
- Built `/review` page (variants grouped by concept, channel differences explained).
- Variant card (Approve, Edit, Discard, Regenerate, Schedule) hooked up to domain actions.
- Verified in browser with stub data.

Needs (Claude Code):
- M1/M2/M3 Backend (Open tasks: prompt chains, DB wiring, Cloudflare Flux, validation logic).

## Claude Code — M1 session (copy engine)
Done — real, not stubs:
- `src/lib/ai/llm.ts`: wired Gemini (native REST, JSON mode, `thinkingConfig: {thinkingBudget:0}` since
  these are structured-output calls not reasoning), Groq + OpenRouter (OpenAI-compatible
  `/chat/completions`). Added `fetchWithRetry` (up to 2 retries, 1s/2.5s backoff, fresh AbortSignal per
  attempt) for transient 429/5xx — free-tier upstreams flake often. `LLM_DEBUG=1` env logs provider
  failures and schema-mismatch raw output for diagnosis. `src/lib/ai/pricing.ts` added (premium cost
  estimate only; free providers always log $0).
- `src/lib/ai/prompts/{plan,copy-bn,copy-en,copy-schema,critic,independence,channel-rules,examples}.ts` —
  system prompts + Zod schemas per bengali-native-copy/prompts.md and examples.md few-shots.
- `src/lib/ai/plan.ts`, `copy.ts`, `critic.ts` — one plan call (all 3 channels + concept, so shots stay
  genuinely different per non-negotiable #1), one independent copy call per (channel × lang) (bn never
  sees en — non-negotiable #2), bn regenerates once if critic score < 4 and keeps the higher-scoring
  attempt, independence judge (bn vs en) folds into the persisted `CriticResult`.
- `src/lib/actions/brief.ts`: `createBrief`/`generateCampaign` are DB-backed — real pipeline (plan → copy
  ×6 → critic/independence → persist `concepts`+`variants`), reads active insights by the brief's
  `appliedInsightIds`, writes back what the plan actually applied (non-negotiable #5, image gen is M2 so
  `assetUrl` stays null). `listConcepts` is still the M0 stub (quick follow-up: same query pattern as
  `listVariants`' briefId filter).
- `src/lib/actions/variants.ts`: `listVariants`/`getVariant` are DB-backed. `approveVariant` /
  `editVariant` / `discardVariant` / `regenerateVariant` are still M0 mock stubs (M3).
- `scripts/try-brief.ts` (`npm run try-brief`) — runs one bn brief through the real pipeline, prints hook/
  char-count/critic-score/independence per channel×lang.

Bug found + fixed along the way: the plan prompt described its schema in prose only, and Groq's fast model
drifted from it hard (renamed fields, invented `youtubeShorts` instead of `youtube`, dropped required
channel fields). Fixed by putting a literal JSON skeleton in `PLAN_SYSTEM_PROMPT` — verified via a direct
API call that Groq then returns the exact shape.

**Not verified this session**: a full clean `npm run try-brief` run start-to-finish. Individual pieces
were each confirmed working with real API calls (plan bundle succeeded with the corrected schema; bn copy
+ critic succeeded and reached the en-copy step; direct Gemini calls produced excellent native chalit
Bengali matching the schema exactly) — but the `GEMINI_API_KEY` free-tier quota got exhausted from this
session's own repeated debugging/testing (`"You exceeded your current quota"`), and the OpenRouter free
fallback model (`google/gemma-4-26b-a4b-it:free`) is separately rate-limited upstream on OpenRouter's
shared pool. `npm run typecheck` and `npm test` are green throughout. Next session: re-run
`LLM_DEBUG=1 npm run try-brief` once the Gemini quota window resets (or point `GEMINI_API_KEY` at a fresh
key) — if it still fails, the debug output names the exact provider/status, no more guessing needed.
