# Build runbook — do the steps in order

Legend: 🧑 you · 🟠 Claude Code (Sonnet, **fresh session per step: `/clear` first**) · 🔵 Antigravity
Steps marked ∥ run in parallel. **Sync point** = both agents commit, then you skim `docs/HANDOFF.md`.

---

## Step 1 · 🧑 Finish the scaffold (10 min)
```powershell
npm pkg set name=hoichoi-studio scripts.typecheck="tsc --noEmit" scripts.test="vitest run" scripts.db:push="drizzle-kit push" scripts.db:seed="tsx scripts/seed.ts"
npm i drizzle-orm @libsql/client zod @vercel/blob image-size mp4box twitter-text
npm i -D drizzle-kit vitest tsx @types/twitter-text sharp
npx shadcn@latest init -d
npx shadcn@latest add button card input textarea select badge tabs dialog table sonner checkbox label separator skeleton tooltip
copy .env.example .env.local   # then fill keys from "API KEYS.md"
git add -A; git commit -m "deps + shadcn"
```

## Step 2 · 🧑 Accounts (15 min, can overlap Step 3)
1. **Cloudflare** → Workers AI → create an API token ("Workers AI" template) + copy the Account ID → `.env.local`.
2. **GitHub**: create a *private* repo and push.
3. **Vercel**: import the repo. Storage → create a **Blob** store (this adds `BLOB_READ_WRITE_TOKEN` automatically). Storage/Marketplace → **Turso** (or turso.tech) → create DB → set `DATABASE_URL` + `DATABASE_AUTH_TOKEN`.
4. Add every `.env.local` key to Vercel env vars (Production + Preview). Set `DEMO_PASSCODE`.

## Step 3 · 🟠 M0: foundation (≈40 min)
```
M0 from docs/PLAN.md, but the scaffold, deps and shadcn are already done — skip those.
Build: src/db/schema.ts + drizzle.config.ts + src/db/index.ts (libsql, env-driven); src/lib/types.ts exporting all shared domain types;
src/lib/domain/{status,approval,clock}.ts with tests first; src/lib/ai/llm.ts skeleton with ai_calls ledger + budget guard (ai-providers skill).
Then create src/lib/actions/ with typed server-action STUBS (signatures + TODO bodies returning mock data) for every screen:
createBrief, generateCampaign, listVariants, approveVariant, editVariant, discardVariant, regenerateVariant, scheduleVariant,
runSchedulerTick, advanceClock, submitRuleBreaker, listPublishAttempts, getComparison, generateWeeklyReport, listInsights.
The stubs are the contract Antigravity builds against, so make the return types final. Run typecheck+test, tick PLAN.md, write a HANDOFF note.
```
🧑 Then run `npm run db:push`, push to GitHub, and confirm the Vercel deploy is green. **You have a live URL.**

## Step 4 ∥ (≈90 min)
🟠 **M1 logic**
```
/next M1 — logic only (UI is Antigravity's). Load bengali-native-copy + channel-tailoring + ai-providers.
Implement llm.ts providers (Gemini, Groq, OpenRouter) with fallback; prompts in src/lib/ai/prompts/; creative plan; per channel×lang copy;
critic + independence judge with one regenerate; fill the real bodies of createBrief/generateCampaign/listVariants.
Test with ONE real Bengali brief via a tsx script and print only the bn/en hooks + critic scores.
```
🔵 **App shell + brief + review screens**
```
Read AGENTS.md, CLAUDE.md, docs/PLAN.md, docs/DEMO.md, src/lib/types.ts, src/lib/actions/*.
Build the app shell: sidebar nav (Studio, Review, Queue, Analytics, Insights, Report), a dark hoichoi-style theme, a header with an app-clock + spend meter slot.
Build /studio (brief form + insight cards panel with toggles, calls createBrief/generateCampaign; passcode field)
and /review (variants grouped by concept → channel × language; image prompt, caption, hashtags, CTA, critic score + flags,
independence badge, status chip; Approve / Edit / Discard-with-note / Regenerate buttons calling the actions).
Use only the action stubs. Verify both pages in the browser. Commit.
```
**Sync point.**

## Step 5 ∥ (≈75 min)
🟠 **M2 image backend**
```
/next M2 — backend part only: src/lib/ai/image.ts (Cloudflare → Pollinations → Gemini chain, native size per channel, cache),
an api route to upload composed assets to Blob (dev fallback public/uploads) that stores sha256/width/height/bytes/duration from the actual bytes,
and src/lib/ai/tailoring.ts dHash similarity with a test. Wire image generation into generateCampaign.
```
🔵 **Composers**
```
Read .claude/skills/channel-tailoring/SKILL.md. Build src/components/render/CanvasComposer.tsx and VideoComposer.tsx:
base image → per-channel overlay layout (IG 1080×1350, X 1600×900, Shorts 1080×1920 video 8–12s, Ken Burns + word-by-word captions,
MediaRecorder mp4 if supported else webm). Load Noto Sans Bengali + Hind Siliguri via next/font and await document.fonts before drawing.
Upload via the upload route from src/app/api (see HANDOFF if missing). Test with a Bengali headline containing conjuncts (e.g. "রহস্যের স্বাদ, ক্ষণে ক্ষণে"),
screenshot-verify each channel in the browser. Show composed assets on /review.
```
**Sync point.** Redeploy.

## Step 6 ∥ (≈60 min)
🟠 **M3 + M4 logic**
```
/next M3+M4 logic. Load adapter-contracts. Implement approve/edit/discard/regenerate actions against the state machine;
specs.ts, validate.ts (byte probing), the 3 mock adapters, the scheduler tick + publish_attempts; fixtures + tests for every rejection code;
submitRuleBreaker with the 3 prebuilt bad payloads. Tests first. Print only the test summary.
```
🔵 **Queue screen**
```
Build /queue: schedule dialog for approved variants, a timeline of scheduled/published/rejected, an "⏩ advance clock" control (+6h/+1d/+7d),
a rule-breaker panel (3 preset bad posts + custom) showing rejection cards (code, field, limit vs actual), and the publish-attempt log.
Show the mock-spec table from the adapter-contracts skill. Commit.
```
**Sync point.** Redeploy. Rehearse DEMO steps 1–7 locally.

## Step 7 ∥ (≈60 min)
🟠 **M5**
```
/next M5. Load demo-seed + grounded-reporting. simulator.ts, ingest.ts, compare.ts (like-for-like by concept + bn vs en),
scripts/seed.ts (4 weeks history with planted patterns, placeholder history images). Hook the simulator into advanceClock. Test determinism + compare math.
```
🔵 **Analytics**
```
Build /analytics: pick a concept → side-by-side table/bar chart of normalised rates across IG/X/Shorts, a bn vs en split per channel,
raw totals in tooltips only, and every row linking to its post (P-xxxx chip). Use the getComparison action. Commit.
```
🧑 `npm run db:seed` locally and on Turso (set DATABASE_URL to Turso temporarily).

## Step 8 ∥ (≈45 min)
🟠 **M6**
```
/next M6. Load grounded-reporting. facts.ts → generate.ts → verify.ts (tests first: missing citation, unknown ID, wrong number) → insights extraction;
the brief flow must inject selected insights and store appliedInsights with howApplied. Seed one verified report with insight cards.
```
🔵 **Report + insights**
```
Build /report (sections with claims, [P-xxxx] chips opening a post drawer, verified badge / failure reasons, "Generate weekly report" button)
and /insights (cards with lever, recommendation, evidence chips, active toggle). On /studio show the plan's "Applied insights → how" section. Commit.
```
**Sync point.** Redeploy. Run the full docs/DEMO.md locally.

## Step 9 ∥ (≈45 min)
🧑 Generate the **demo campaign** for real (Bengali brief, passcode). Then leave it in mixed states: discard one + regenerate, approve some, publish, advance the clock.
🟠 `/verify` across everything, then fix open HANDOFF items and make seed.ts re-create the demo campaign from `public/demo/campaign/`.
🔵 README: architecture diagram, judging criteria → evidence table (from docs/ACCEPTANCE.md), screenshots, how to run, live URL.

## Step 10 · 🧑 Ship (30 min)
Final deploy → run docs/DEMO.md on the **live URL** → record a 3–4 min backup screen video → submit.

---
**If you hit the Claude Code limit:** hand the current 🟠 prompt to Antigravity as-is. It has the same contract via AGENTS.md.
**If behind at Step 7:** simplify Analytics to a table (no chart) and skip TTS. Never skip the gate, rejections, native bn, or the insight loop.
