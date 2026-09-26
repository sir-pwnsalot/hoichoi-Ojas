# hoichoi Content Studio — Hackathon build (Problem 3)

One content brief goes in. Out come on-brand, per-channel assets (Instagram, X, YouTube Shorts) in **Bengali and English**. A human approves them before anything is scheduled. They are then published through **mock adapters**, metrics are ingested, a cross-platform comparison and a cited weekly AI report are produced, and **insights feed back into the next brief**.
Solo build, ~7h budget, deployed free on Vercel. Optimise for: working end-to-end demo > breadth > polish.

## Non-negotiables (auto-disqualifiers if broken — never trade these for speed)
1. **Per-channel generation.** Each channel gets its own creative plan, image prompt, composition and native aspect ratio. Never crop or resize one master image. `lib/ai/tailoring` must reject variants whose dHash similarity is > 0.85.
2. **Native Bengali.** Bengali copy is generated *from the brief* in its own call with a Bengali system prompt. It is NEVER produced by translating the English output. Load skill `bengali-native-copy` before touching any copy prompt.
3. **Approval gate in the domain layer.** `schedule()` throws unless a valid approval exists whose `contentHash` matches the current copy+asset. Editing a variant clears its approval. The UI hiding a button does not count as a gate.
4. **Adapters are the authority.** `validate()` inspects the **actual bytes** (dimensions, file size, duration, format) and the real caption (weighted char count, hashtag count). Violations return typed rejections and get logged. Nothing is silently accepted or auto-fixed.
5. **Every report claim cites post IDs, and insights reach the brief.** The report is generated as JSON claims with `postIds[]` and goes through a deterministic verifier. Insight cards are shown in the brief form and injected into generation, and the brief records `appliedInsightIds`.

## Stack
Next.js (App Router) + TypeScript strict · Tailwind + shadcn/ui · Drizzle ORM + libSQL (`file:local.db` in dev, Turso in prod) · Vercel Blob (dev fallback: `public/uploads`) · Zod on every AI output + route input · Vitest.
Bengali text is rendered in the **browser** (canvas, fonts: Noto Sans Bengali / Hind Siliguri) for both image overlays and the 9:16 video (canvas + MediaRecorder → MP4). Do NOT render Bengali server-side (Satori and Pillow break conjuncts).

## Commands
```
npm run dev          # next dev
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run db:push      # drizzle-kit push
npm run db:seed      # tsx scripts/seed.ts  (idempotent: history + demo campaign)
npm run lint
```

## Layout
```
src/app/            studio/ (brief) · review/ · queue/ (publisher) · analytics/ · insights/ · report/ · api/
src/db/schema.ts    single schema file — see docs/ARCHITECTURE.md
src/lib/ai/         llm.ts (router+fallback+cost ledger) · image.ts · prompts/ · tailoring.ts · critic.ts
src/lib/domain/     status.ts (state machine) · approval.ts · scheduler.ts
src/lib/adapters/   types.ts · specs.ts · validate.ts · instagram.ts · x.ts · youtube.ts
src/lib/analytics/  simulator.ts · ingest.ts · compare.ts
src/lib/report/     facts.ts · generate.ts · verify.ts · insights.ts
src/components/render/  CanvasComposer (image overlay) · VideoComposer (9:16 clip)
scripts/seed.ts     tests/ (vitest, mirrors src/lib)
```

## Skills — load before working in that area
| Area | Skill |
|---|---|
| Any Bengali/English copy prompt, critic, brand voice | `bengali-native-copy` |
| Per-channel creative plan, image prompts, composition, copy conventions | `channel-tailoring` |
| Adapters, platform specs, validation, publish flow | `adapter-contracts` |
| Weekly report, insight cards, comparison, brief feedback loop | `grounded-reporting` |
| Metrics simulator, seed data, demo campaign | `demo-seed` |
| LLM/image provider routing, fallbacks, cost cap | `ai-providers` |

## Working agreement
- `docs/PLAN.md` is the source of truth. Work milestone by milestone and tick the boxes as you go. `/next` starts the next milestone and `/verify` checks it.
- Before saying a milestone is done: run `npm run typecheck && npm test`, then click through the flow in the browser. Update `docs/ACCEPTANCE.md` evidence.
- Domain rules (gate, validation, verifier) get unit tests **first**. UI gets no tests; demo it instead.
- All model IDs, keys and budgets come from env (`.env.example`). Never hardcode model names, since they change.
- Every AI call goes through `lib/ai/llm.ts` or `image.ts`. Never call a provider SDK directly from a route.
- Keep deps minimal. Justify any new dependency in the commit message.
- Never read or print `.env.local` or `API KEYS.md`. Never commit secrets.
- Parallel build with Antigravity (ownership split in AGENTS.md). You own `src/lib` (incl. `src/lib/actions`), `src/app/api`, `src/db`, `scripts`, `tests`. At session start, process open items in `docs/HANDOFF.md`; at session end, append a short Done/Needs note there.
- Next.js 16 is newer than your training data: for routing, caching, server actions, `params` or config APIs, grep `node_modules/next/dist/docs/` for the specific guide instead of guessing.
- Deploy to Vercel early (end of M0) and again after each milestone. Don't leave deploy to the last hour.
- If behind schedule, cut in this order: TTS voiceover → version-history UI → animations. Never cut a non-negotiable.

@AGENTS.md
