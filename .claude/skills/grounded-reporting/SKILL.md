---
name: grounded-reporting
description: Use when building the like-for-like cross-platform comparison, the weekly AI report, the claim verifier, insight-card extraction, or the insights → brief feedback loop. Every claim must cite post IDs and insights must reach brief creation.
---

# Grounded reporting and the feedback loop

Two things to get right: (1) comparison is **like-for-like**, not per-platform totals; (2) insights must **reach brief creation**, or we're disqualified. And every report claim must cite post IDs.

## Like-for-like comparison (`lib/analytics/compare.ts`)
- Key = `conceptId`. For each concept, one row per metric and one column per channel, using **normalised rates** (see docs/ARCHITECTURE.md), plus a bn-vs-en split on the same channel.
- Only compare posts that have been live about the same time (align on hours since publish, e.g. at 72h).
- Show raw totals only as secondary info in a tooltip.

## Report pipeline: facts → claims → verify → render
1. **`facts.ts`** computes a compact facts table for the week in code: per post (id, concept, channel, lang, format, ctaType, hour, rates, totals) plus pre-computed comparisons (channel × lang means, top/bottom posts, deltas). The LLM never does arithmetic.
2. **`generate.ts`** sends the LLM the facts JSON and asks for:
```json
{ "summary": [Claim], "sections": [{ "title": "...", "claims": [Claim] }],
  "insights": [{ "statement", "lever": "lang|channel|cta|time|format|hook", "recommendation", "evidencePostIds": [] }] }
Claim = { "text": "... [P-0012] ...", "postIds": ["P-0012"], "figures": [{ "postId"?, "metric", "value" }] }
```
3. **`verify.ts`** (deterministic, unit-tested):
   - every claim has ≥ 1 postId, and every inline `[P-xxxx]` is in `postIds`
   - every postId exists and was published in the report week
   - every figure matches the facts table (±0.5% relative, or the same when rounded to what's displayed)
   - on failure: collect the errors, regenerate once with the errors as feedback, then drop the failing claims and mark the report `verified=false` with the reasons shown. Never show an unverified claim as if it were verified.
4. **Render**: `[P-0012]` becomes a clickable chip linking to the post card (channel, lang, thumbnail, metrics).

## Insight cards → brief (the loop)
- Insights saved from the report are `active=true`. Keep them actionable, with one `lever` each and a concrete recommendation.
- **Brief form** (`/studio`) shows active insight cards with evidence chips. The top 3 relevant ones are pre-selected (by lever match on channel/lang/format), and the user can toggle them.
- The selected cards are injected into the creative-plan prompt as constraints. The plan must return `appliedInsights[{insightId, howApplied}]`, which is stored on `briefs.appliedInsightIds` and shown on the plan and review screens.
- The demo needs this visible: "Insight #3 (Bengali question-CTA Reels outperform) → Shorts variant uses a Bengali question hook".
