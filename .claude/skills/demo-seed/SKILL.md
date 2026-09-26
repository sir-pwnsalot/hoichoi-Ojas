---
name: demo-seed
description: Use when working on the metrics simulator, metric ingestion, seed script, historical data, the pre-generated demo campaign, or the app clock. Makes the analytics realistic enough that the report finds real patterns, and keeps the live link working without API calls.
---

# Simulator, seed and demo campaign

## Simulator (`lib/analytics/simulator.ts`)
- **Deterministic**: a PRNG (mulberry32) seeded from `hash(variantId)`, so reruns give identical numbers.
- Emits **platform-native payloads** (IG: impressions/reach/likes/comments/saves/shares; X: impressions/likes/reposts/replies/bookmarks/link_clicks; YT: views/likes/comments/shares/avg_view_duration). `ingest.ts` maps them into `metrics`, and the mapping is part of the story ("unified store").
- Engagement = platform base rate × feature multipliers × noise (±15%), accumulated over a decay curve (≈60% by 24h, 90% by 72h).
- **Planted patterns**, so the report has something true to find:
  - bn beats en on Instagram and Shorts (≈1.3×); en is roughly equal on X
  - question/comment CTA gives ≈1.25× comments on IG
  - posts at 19:00–22:00 IST get ≈1.2× on every channel
  - more than 3 hashtags on X gives ≈0.85×
  - video on Shorts has the highest share rate
- Snapshots are written when the app clock passes each capture point (1h, 6h, 24h, 72h, 7d).

## Seed (`scripts/seed.ts`, idempotent: upsert by fixed IDs)
- Brand kit row, and 4 weeks of history: ~6 concepts × 3 channels × 2 langs ≈ 36 published posts with real-looking captions (write them natively, following `bengali-native-copy`), with varied hour/CTA/hashtags so the planted patterns show up.
- Assets for history: small placeholder images in `public/demo/history/` (a gradient + title rendered once). Real generation isn't needed for history.
- One pre-computed verified weekly report with insight cards, so `/insights` and the brief form are populated from minute one.
- **Demo campaign**: one fully generated brief (Bengali brief text) with all variants and assets in `public/demo/campaign/`, in mixed states (some draft, one discarded with a v2, some approved), so every screen works with zero API calls.

## App clock
`app_clock.offsetMs`, with a helper `now()` used everywhere instead of `Date.now()`. The "⏩ advance clock" control offers +6h / +1d / +7d. Advancing runs the scheduler tick and simulator capture.

## Live-link safety
Generation endpoints require `DEMO_PASSCODE` (header or cookie). Without it, the UI shows the seeded campaign with a "Generate (passcode)" button. Rate limit: 10 generations/hour per IP (in-memory is fine).
