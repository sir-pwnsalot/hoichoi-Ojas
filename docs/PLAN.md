# Build plan — tick boxes as you go

Budget ~7h solo. Each milestone ends deployable. Times are targets, not limits.

## M0 · Skeleton + gate (0:00–0:45)
- [x] `create-next-app` into a temp subfolder (the root isn't empty, so it would refuse), then move everything up, keeping our .gitignore; shadcn init, Drizzle + libSQL, Vitest
- [x] `src/db/schema.ts` per docs/ARCHITECTURE.md; `db:push` works on local file
- [x] `lib/domain/status.ts` state machine + `approval.ts` (contentHash) + tests: illegal transitions throw; schedule without approval throws; edit after approval invalidates
- [x] `lib/ai/llm.ts` router skeleton + cost ledger + budget guard (see `ai-providers`)
- [ ] Deploy empty app to Vercel with Turso + Blob env vars ✅ live URL

## M1 · Brief → tailored copy (0:45–2:15)
- [ ] Brief form: title, show/topic, key message, audience, languages [bn, en], tone, CTA goal, date; brief may itself be in Bengali
- [ ] Insight cards panel on the brief form (reads active `insights`; empty state OK until M6)
- [ ] Creative plan call → per channel: angle, hook, tone, length, CTA type, hashtag strategy, visual composition, image prompt (Zod-validated)
- [ ] Copy generation: separate calls per (channel × language); bn uses the Bengali system prompt
- [ ] Nativeness critic (bn) + independence check (bn is not a translation of en); regenerate once if score < 4
- [ ] Persist as `variants` (status `draft`), with `appliedInsightIds` on the brief

## M2 · Visuals (2:15–3:30)
- [ ] `image.ts`: Cloudflare Flux → Pollinations → Gemini (paid) fallback chain; generate at native size per channel
- [ ] `CanvasComposer`: headline/CTA overlay in bn/en using brand kit, per-channel layout and safe zones → PNG → Blob
- [ ] `VideoComposer`: 9:16 ~8–12s clip (Ken Burns over 2–3 frames + animated captions) → MP4 → Blob
- [ ] dHash similarity check across a brief's variants (non-negotiable #1)

## M3 · Review gate (3:30–4:15)
- [ ] Review screen: variants grouped by channel × language, the 3 image prompts side by side, critic score and flagged phrases
- [ ] Approve (records approver, time, contentHash) · Edit (clears approval) · Discard + note → regenerate that variant with the note → new version

## M4 · Publisher (4:15–5:00)
- [ ] Specs + byte-level `validate()` + 3 mock adapters + tests using fixtures (good and bad for each rule)
- [ ] Schedule approved variants (datetime); scheduler tick on page load + "⏩ advance clock" demo control
- [ ] Publish → adapter → `published` with externalId, or `rejected` with typed reasons; every attempt logged
- [ ] "Rule-breaker" demo panel: submit oversized / wrong-ratio / 300-char-X post and show the rejection

## M5 · Analytics store + comparison (5:00–6:00)
- [ ] Simulator emits platform-native metric payloads for published posts → `ingest` normalises into `metrics`
- [ ] Seed: 4 weeks history with planted patterns (see `demo-seed`)
- [ ] Like-for-like view: per concept, the 3 platforms side by side on normalised rates; bn vs en on the same platform

## M6 · Report + loop (6:00–6:45)
- [ ] `facts.ts` → `generate.ts` (JSON claims with postIds) → `verify.ts` (reject + regenerate once) → render with clickable post chips
- [ ] Insight cards extracted from the report → shown in the brief form → injected into the plan prompt → the plan lists how each one was applied

## M7 · Ship (6:45–7:30)
- [ ] Pre-generated demo campaign seeded so the live link works with zero API calls; generation behind `DEMO_PASSCODE`
- [ ] README: architecture diagram, judging-criteria → evidence table (from ACCEPTANCE.md), how to run
- [ ] Final deploy, then run docs/DEMO.md end to end on the live URL

## Stretch (only if all above is green)
- [ ] Bengali voiceover on the Shorts clip via Gemini TTS
- [ ] Paid-model upgrade pass (see `ai-providers` budget table)
