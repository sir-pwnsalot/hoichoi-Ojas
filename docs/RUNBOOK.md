# Build runbook — follow top to bottom

**Who:** 🧑 you (terminal / browser) · 🟠 Claude Code (terminal) · 🔵 Antigravity (IDE agent panel)
**Format of every step:** WHEN you start it → the exact PROMPT to paste → DONE WHEN (what to check) → the next step.
Steps marked **∥** run at the same time in both tools. Don't start a later step until its "DONE WHEN" is true.

### Standing rules (read once)
- 🟠 Claude Code: model **Sonnet**. Start **every** 🟠 step with `/clear`, then paste the prompt. If `/context` shows > 60% mid-step, run `/compact`.
- 🔵 Antigravity: **Planning** mode with the Pro-tier Gemini model for new screens/composers; **Fast** mode for small fixes. New conversation per step.
- Both tools edit the same folder. They must not touch each other's files (split in `AGENTS.md`). Cross-requests go in `docs/HANDOFF.md`.
- 🧑 After every ∥ pair, run the **SYNC** block below before moving on.

### SYNC block (🧑, after every parallel step, 3 min)
```powershell
git status --short        # anything uncommitted? tell that agent to commit
npm run typecheck
npm test
npm run dev               # click through the pages touched in this step
```
Open `docs/HANDOFF.md`. Any unchecked item for 🟠 gets carried into the next 🟠 step automatically (its prompt says so); the same goes for 🔵.
If typecheck fails, paste **only the error lines** into the owning tool with: `Fix these type errors, touch only your own files:` + errors.

---

## STEP 0 · 🧑 Fix install gaps (5 min) — do now
```powershell
npm uninstall cn
npm i -D drizzle-kit vitest tsx @types/twitter-text sharp
git add -A; git commit -m "dev deps"
```
Fill `.env.local`: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, the three model IDs, Cloudflare (Step 1), DEMO_PASSCODE. Leave DATABASE_URL=file:local.db for now.
**DONE WHEN:** `npm run check:setup` shows no ❌ in sections 1–4. (Run `npm run check:setup -- --models` to list the exact model IDs your keys can use, then paste them into `.env.local`.)

## STEP 1 · 🧑 Accounts (15 min) — do it while Step 2 runs
1. Cloudflare dashboard → AI → Workers AI → "Use REST API" → create token + copy the Account ID → `.env.local`.
2. Create a **private** GitHub repo → `git remote add origin <url>; git push -u origin main`.
3. Vercel → Add New Project → import the repo (don't deploy yet if prompted; it's fine if it deploys).
4. Vercel project → Storage → Create **Blob** (adds BLOB_READ_WRITE_TOKEN). Storage → Marketplace → **Turso** → create DB (adds DB env vars; rename them to DATABASE_URL / DATABASE_AUTH_TOKEN if different).
5. Vercel → Settings → Environment Variables → add every key from `.env.local` except DATABASE_* (Turso already set them).

**DONE WHEN:** `npm run check:setup` shows **zero ❌**. To test Turso, temporarily put the Turso URL and token in `.env.local`, rerun, then switch back to `file:local.db`. Vercel → Deployments shows the latest one as **Ready**.

---

## STEP 2 · 🟠 Foundation + contract (≈40 min)
**WHEN:** Step 0 done.
```
/clear
```
```
Read CLAUDE.md and docs/PLAN.md M0. Scaffold, deps and shadcn are already done; skip them.
Load skills: ai-providers, adapter-contracts (for types only).
Build, in this order:
1. src/db/schema.ts exactly per docs/ARCHITECTURE.md, drizzle.config.ts, src/db/index.ts (libsql client from DATABASE_URL/DATABASE_AUTH_TOKEN).
2. src/lib/types.ts — all shared domain types (Channel, Lang, VariantStatus, Variant, Brief, InsightCard, Rejection, ComparisonRow, ReportClaim…).
3. src/lib/domain/status.ts, approval.ts (contentHash), clock.ts (now() with app_clock offset). Write tests FIRST in tests/domain/: illegal transitions throw, schedule without approval throws, edit after approval clears it.
4. src/lib/ai/llm.ts skeleton: generateJSON signature, provider chain placeholder, ai_calls ledger write, BudgetExceededError guard.
5. src/lib/actions/*.ts — "use server" STUBS with FINAL typed signatures returning realistic mock data:
   createBrief, generateCampaign, listVariants, getVariant, approveVariant, editVariant, discardVariant, regenerateVariant,
   scheduleVariant, runSchedulerTick, advanceClock, getClock, submitRuleBreaker, listPublishAttempts,
   getComparison, listConcepts, generateWeeklyReport, getLatestReport, listInsights, toggleInsight, getSpend.
   Export an index. These are the contract the UI team builds against; do not change signatures later without a HANDOFF note.
6. vitest.config.ts. Run `npm run db:push`, `npm run typecheck`, `npx vitest run --reporter=dot`.
Then tick M0 boxes in docs/PLAN.md, and append to docs/HANDOFF.md: "Step 2 done — action stubs ready in src/lib/actions".
Commit: "m0: schema, domain gate, action contract".
Keep your replies short: no file dumps, just what changed and test results.
```
**DONE WHEN:** tests green, `src/lib/actions/index.ts` exists, committed.
🧑 Then: `git push`, open the Vercel deployment → it's green → **save the live URL**. (If the build fails, paste the Vercel error lines into 🟠: `Vercel build fails with: … Fix it.`)

---

## STEP 3 ∥ (≈90 min)
### 3A · 🟠 Copy engine (M1 logic)
**WHEN:** Step 2 DONE.
```
/clear
```
```
Read CLAUDE.md, docs/PLAN.md M1, and open items for Claude in docs/HANDOFF.md.
Load skills: bengali-native-copy (incl. examples.md + prompts.md), channel-tailoring, ai-providers.
Implement (logic only; UI is Antigravity's, don't touch src/app pages or src/components):
1. llm.ts providers: Gemini (REST), Groq (OpenAI-compatible), OpenRouter (OpenAI-compatible); routing by purpose per the ai-providers table; fallback on 429/5xx/timeout; Zod retry once; ledger.
2. src/lib/ai/prompts/*.ts: plan, copy-bn (Bengali system prompt), copy-en, critic, independence — from prompts.md, with examples.md few-shots.
3. src/lib/ai/plan.ts (creative plan incl. appliedInsights), src/lib/ai/copy.ts (one call per channel × lang, bn never sees en), src/lib/ai/critic.ts (score<4 → regenerate once with flags).
4. Replace the stubs createBrief / generateCampaign / listVariants / getVariant with real DB-backed code (images come in a later step; leave assetUrl null).
5. scripts/try-brief.ts: runs ONE Bengali brief end to end and prints only: per channel × lang the hook, char count, critic score, independence verdict.
Run it once. If the Bengali reads translated, tighten the prompt and run once more (max 2 runs, since free quota is limited).
Tick PLAN.md, append a HANDOFF note (what's real now), commit "m1: copy engine". Short replies.
```
Bengali test brief for try-brief.ts (paste if it asks):
`নতুন থ্রিলার সিরিজ 'ধোঁয়াশা' আসছে ১৭ অক্টোবর। উত্তর কলকাতার এক পুরনো পাড়ায় তালাবন্ধ বাড়ির দেওয়ালে রাতারাতি হাতের ছাপ। টার্গেট: ১৮–৩৫, থ্রিলার-প্রেমী বাঙালি। লক্ষ্য: ট্রেলার দেখানো আর প্রিমিয়ারের আগে আলোচনা তৈরি।`

**DONE WHEN:** try-brief output shows 6 variants, bn critic ≥ 4, independence = "not a translation". **You read the Bengali yourself.** You're the native-speaker judge.

### 3B · 🔵 App shell + Studio + Review screens
**WHEN:** Step 2 DONE (same time as 3A).
```
Read AGENTS.md, CLAUDE.md, docs/PLAN.md, docs/DEMO.md, docs/ARCHITECTURE.md, src/lib/types.ts and src/lib/actions/index.ts.
You own src/app pages/layouts (not src/app/api) and src/components. Call data ONLY via the server actions in src/lib/actions.
Build:
1. App shell: left sidebar nav (Studio, Review, Queue, Analytics, Insights, Report), a dark cinematic theme (hoichoi-like: near-black background, a bold red accent, clean sans; Bengali text in Noto Sans Bengali / Hind Siliguri via next/font), and a header showing the app clock (getClock) and spend meter (getSpend).
2. /studio: brief form (title, show, key message, audience, languages bn/en checkboxes, tone, CTA goal, date, free-text brief that accepts Bengali), a right-side "Insights to apply" panel listing listInsights() cards with toggles (top 3 preselected), a passcode field, a Generate button → generateCampaign → then show the plan summary incl. an "Applied insights → how" list, and a link to Review.
3. /review: variants grouped by concept → a grid of channel (IG / X / Shorts) × language (bn / en). Each card: asset preview slot (placeholder if assetUrl null), hook, caption, hashtags, CTA, char count, image prompt (collapsible), critic score + flag list with rewrites, independence badge, status chip, version number. Buttons: Approve, Edit (inline textarea → editVariant), Discard (requires a note) → Regenerate, Schedule (disabled unless status=approved, with a tooltip explaining the gate).
   Add a "Why these differ" strip per concept: a small table comparing channels (length, CTA type, hashtag count, tone).
4. Loading, empty and error states; toast on every action.
Verify both pages in the browser with the stub data. Commit "ui: shell, studio, review". Append a Done/Needs note to docs/HANDOFF.md.
```
**DONE WHEN:** both pages render and all buttons call actions without errors.

➡️ **SYNC block.** Then 🧑 open /studio, run a real Bengali generation locally (3A made it real), and check it shows up in /review.

---

## STEP 4 ∥ (≈75 min)
### 4A · 🟠 Image backend
**WHEN:** Step 3 SYNC done.
```
/clear
```
```
Read CLAUDE.md, docs/PLAN.md M2, open Claude items in docs/HANDOFF.md. Load skills: channel-tailoring, ai-providers.
Implement:
1. src/lib/ai/image.ts: Cloudflare Flux → Pollinations → Gemini (only if GEMINI_IMAGE_MODEL set) chain; generate at the native size per channel; cache by hash(prompt,w,h,seed); prompts always add "no text, no letters, no watermark".
2. src/app/api/assets/route.ts: POST (multipart or raw) for composed assets from the browser → store to Vercel Blob (fallback public/uploads in dev) → compute sha256, width, height, bytes (and duration for MP4 via mp4box) FROM THE BYTES → update the variant. Also GET /api/base-image?variantId= returning the generated base image.
3. src/lib/ai/tailoring.ts: dHash (via sharp, 9×8 greyscale) + similarity; a test that a crop of an image is flagged > 0.85 and two different images are not. Store the similarities per concept; expose them in listVariants.
4. Wire generateCampaign to create base images per channel (Shorts gets 2–3 vertical frames).
Tests green, tick PLAN.md, HANDOFF note documenting the /api/assets contract for the composers, commit "m2: image backend". Short replies.
```
**DONE WHEN:** a generation produces 3 different base images at the 3 native sizes; the dHash test is green.

### 4B · 🔵 Composers
**WHEN:** Step 3 SYNC done (same time as 4A).
```
Read AGENTS.md, .claude/skills/channel-tailoring/SKILL.md, docs/HANDOFF.md.
Build src/components/render/CanvasComposer.tsx and VideoComposer.tsx (client components):
- CanvasComposer: input = base image URL, channel, lang, overlay text (hook/CTA), brand bug. Output exact sizes: Instagram 1080×1350, X 1600×900. Layout per the channel matrix (IG: lower-third hook + gradient scrim; X: headline in the left third). Await document.fonts.load for Noto Sans Bengali and Hind Siliguri BEFORE drawing. Export PNG (toBlob).
- VideoComposer: 1080×1920, 10 s, 30 fps, Ken Burns across the Shorts frames, captions animating word by word inside safe zones (avoid top 12% / bottom 20%), end card with show title + "hoichoi". Record with MediaRecorder: 'video/mp4' if isTypeSupported, else webm. Show progress.
- On /review, each variant card gets a "Render" button → composer → POST to /api/assets (see the contract in HANDOFF; if it's not there yet, stub the upload with a TODO(lib) and continue) → the card shows the final asset.
- Add a "Render all" button per concept.
Test in the browser with a Bengali hook containing conjuncts: "রহস্যের স্বাদ, ক্ষণে ক্ষণে". Take screenshots of all three outputs and check for no broken glyphs.
Commit "ui: composers". HANDOFF Done/Needs note.
```
**DONE WHEN:** all three channel assets render with correct Bengali, and the video downloads and plays.

➡️ **SYNC block.** Then 🧑 `git push` → check the live URL still builds.

---

## STEP 5 ∥ (≈60 min)
### 5A · 🟠 Gate actions + adapters + scheduler
**WHEN:** Step 4 SYNC done.
```
/clear
```
```
Read CLAUDE.md, docs/PLAN.md M3+M4, open Claude items in docs/HANDOFF.md. Load skill: adapter-contracts.
TESTS FIRST, then code:
1. Real bodies for approveVariant, editVariant, discardVariant, regenerateVariant (reuses copy/image pipeline with the discard note, version+1, parentId), scheduleVariant (throws without a valid approval hash).
2. src/lib/adapters/{types,specs,validate,instagram,x,youtube}.ts: byte-level probing (image-size, mp4box), grapheme counts via Intl.Segmenter, X via twitter-text weightedLength, collect ALL rejections, publish() calls validate() itself, publish_attempts logged.
3. tests/fixtures (generate with a small sharp script) + tests for EVERY RejectionCode, incl. a Bengali+emoji caption over the limit.
4. src/lib/domain/scheduler.ts: runSchedulerTick publishes due posts (re-checks the approval hash → NOT_APPROVED); advanceClock(+6h/+1d/+7d) then tick.
5. submitRuleBreaker: 3 presets (1:1 video → Shorts, 11 MB PNG → IG, 310-char post → X) + custom payload → returns rejections.
Run `npx vitest run --reporter=dot`. Tick PLAN.md, HANDOFF note, commit "m3-m4: gate + adapters". Short replies.
```
**DONE WHEN:** every RejectionCode has a passing test; scheduling an unapproved variant throws.

### 5B · 🔵 Queue screen
**WHEN:** Step 4 SYNC done (same time as 5A).
```
Read AGENTS.md, .claude/skills/adapter-contracts/SKILL.md, docs/DEMO.md steps 5–7, docs/HANDOFF.md.
Build /queue:
1. "Ready to schedule": approved variants with a datetime picker → scheduleVariant. Show the error toast if the gate blocks.
2. Timeline table: scheduled / published (externalId) / rejected (reason chips), sorted by time.
3. Header control "⏩ Advance clock" with +6h / +1d / +7d → advanceClock → refresh.
4. "Rule-breaker" panel: 3 preset buttons + a custom form (channel, caption, file upload) → submitRuleBreaker → red rejection cards with code, field, limit vs actual, message.
5. Publish-attempt log (listPublishAttempts), newest first.
6. A collapsible "Mock platform specs" table (from the skill), labelled "mock spec based on public platform limits".
Browser-verify with stubs or real data. Commit "ui: queue". HANDOFF note.
```
**DONE WHEN:** the rule-breaker shows three rejection cards and advancing the clock publishes due posts.

➡️ **SYNC block.** Then 🧑 rehearse DEMO.md steps 1–7 locally, then `git push`.

---

## STEP 6 ∥ (≈60 min)
### 6A · 🟠 Analytics store + seed
**WHEN:** Step 5 SYNC done.
```
/clear
```
```
Read CLAUDE.md, docs/PLAN.md M5, open Claude items in docs/HANDOFF.md. Load skills: demo-seed, grounded-reporting.
1. src/lib/analytics/simulator.ts (deterministic mulberry32, platform-native payloads, planted patterns, capture points), ingest.ts (native → metrics), compare.ts (like-for-like by concept on normalised rates at a common age, plus bn vs en per channel).
2. Hook the simulator into advanceClock / runSchedulerTick.
3. Real getComparison / listConcepts.
4. scripts/seed.ts, idempotent: brand kit, 4 weeks of history (~36 posts, native bn/en captions, varied hour/CTA/hashtags), placeholder history images generated with sharp into public/demo/history/, metrics via the simulator.
Tests: determinism, compare math on a tiny fixture. Tick PLAN.md, HANDOFF note, commit "m5: analytics + seed". Short replies.
```
**DONE WHEN:** `npm run db:seed` works twice in a row with no duplicates.

### 6B · 🔵 Analytics screen
**WHEN:** Step 5 SYNC done (same time as 6A).
```
Read AGENTS.md, .claude/skills/grounded-reporting/SKILL.md (comparison section), docs/ARCHITECTURE.md (normalised rates), docs/HANDOFF.md.
Build /analytics:
1. Concept picker (listConcepts).
2. Like-for-like table: rows = metrics (engagement rate, share rate, save rate, completion proxy), columns = Instagram / X / Shorts, each cell with its post ID chip. The best cell per row is highlighted. Raw totals only in tooltips.
3. A grouped bar chart (recharts or plain SVG) of engagement rate by channel, split bn vs en.
4. A "bn vs en" mini-table per channel with the delta %.
5. Post chips open a drawer with the post (asset thumb, caption, metrics over time).
Commit "ui: analytics". HANDOFF note.
```
**DONE WHEN:** a seeded concept shows the side-by-side table with post chips.

➡️ **SYNC block.** Then 🧑 seed production: temporarily set DATABASE_URL + DATABASE_AUTH_TOKEN in `.env.local` to the Turso values → `npm run db:push` → `npm run db:seed` → switch back to `file:local.db`.

---

## STEP 7 ∥ (≈45 min)
### 7A · 🟠 Cited report + insight loop
**WHEN:** Step 6 SYNC done.
```
/clear
```
```
Read CLAUDE.md, docs/PLAN.md M6, open Claude items in docs/HANDOFF.md. Load skill: grounded-reporting.
TESTS FIRST for verify.ts: claim without a citation, unknown post ID, post outside the week, wrong number → each rejected.
1. src/lib/report/facts.ts (all numbers computed in code), generate.ts (JSON claims + insights), verify.ts, and one regenerate with the errors, then drop failing claims and mark the report unverified with reasons.
2. insights.ts: save the report's insights as active cards (lever + recommendation + evidencePostIds).
3. Real generateWeeklyReport / getLatestReport / listInsights / toggleInsight.
4. Close the loop: generateCampaign injects the selected insights into the plan prompt; the plan returns appliedInsights[{insightId, howApplied}], stored on the brief and returned to the UI.
5. Seed one verified report + its insight cards (extend seed.ts, idempotent).
Tick PLAN.md, HANDOFF note, commit "m6: report + loop". Short replies.
```
**DONE WHEN:** the verifier tests are green; a generated report has citations on every claim.

### 7B · 🔵 Report + Insights screens
**WHEN:** Step 6 SYNC done (same time as 7A).
```
Read AGENTS.md, .claude/skills/grounded-reporting/SKILL.md, docs/DEMO.md steps 1–2 and 9, docs/HANDOFF.md.
1. /report: week selector, "Generate weekly report" (passcode), a Verified badge (or a red "Unverified" with reasons), sections of claims where every [P-xxxx] renders as a clickable chip opening the post drawer from /analytics (reuse it), and the extracted insight cards at the bottom with "Send to next brief".
2. /insights: all cards (lever, statement, recommendation, evidence chips, active toggle).
3. /studio: make sure active insights appear preselected, and after generation show "Applied insights → how" prominently (this is a judging criterion).
Commit "ui: report + insights". HANDOFF note.
```
**DONE WHEN:** you can go report → insight card → studio → generate → see "Applied insights" on the plan.

➡️ **SYNC block.** Then 🧑 run the whole of docs/DEMO.md locally, `git push`, and check the live URL.

---

## STEP 8 ∥ (≈45 min) — finish
### 8A · 🧑 Demo campaign (real generation)
On the **live URL** with the passcode: create the Bengali brief from Step 3A → generate → render all → discard one with a note and regenerate → approve the rest → schedule → advance the clock +1d, +7d → generate the weekly report.

### 8B · 🟠 Verify + harden
**WHEN:** 8A done.
```
/clear
```
```
Run /verify across ALL milestones. Then:
1. Close every open Claude item in docs/HANDOFF.md.
2. Rate-limit the generation actions (10/hour per IP, in-memory) and require DEMO_PASSCODE server-side.
3. Make sure every page works with zero API calls using seeded data (no crash if keys are missing).
4. Fill in the Evidence column of docs/ACCEPTANCE.md with test names and screens.
Commit "harden". Short replies.
```

### 8C · 🔵 README
**WHEN:** 8A done (same time as 8B).
```
Write README.md for judges: one-paragraph pitch; live URL + passcode note; an architecture diagram (mermaid) of Brief → Plan → Copy/Visuals → Review gate → Queue → Adapters → Metrics → Comparison → Report → Insights → Brief;
a "Judging criteria → where to see it" table built from docs/ACCEPTANCE.md; 5 screenshots from the live app (studio w/ applied insights, review grid, rule-breaker rejections, analytics like-for-like, cited report);
"Why Bengali is native, not translated" (a short explanation + one bn/en pair from the demo campaign); local setup steps. Commit "docs: readme".
```

## STEP 9 · 🧑 Ship (30 min)
`git push` → Vercel green → run docs/DEMO.md end to end on the live URL → record a 3–4 min backup video → submit the URL + repo + video.

---
### If something goes wrong
- **Claude Code limit hit:** paste the current 🟠 prompt into Antigravity with this prefix: `Claude Code is unavailable; you temporarily own src/lib, src/app/api, src/db, scripts, tests for this task.`
- **Free-tier quota hit:** set `LLM_TIER=premium` + OPENROUTER_MODEL_PREMIUM (and GEMINI_IMAGE_MODEL) and keep going. The budget guard caps spend at $20.
- **An agent breaks the other's files:** `git checkout -- <file>`, then remind it: `Only edit files you own per AGENTS.md.`
- **Behind schedule at Step 6:** 6B becomes a table only (no chart). Cut TTS entirely. Never cut the gate, rejections, native bn, or the insight loop.
