# Architecture

## Flow
```
Brief (+ selected insight cards)
  → Creative plan (per channel)            lib/ai/prompts/plan
  → Copy per channel × language             bn: native prompt · en: native prompt (independent calls)
  → Critic + independence check (bn)        lib/ai/critic
  → Image per channel at native size        lib/ai/image → CanvasComposer overlay / VideoComposer
  → variants [draft] → review → [approved] (contentHash)
  → schedule → [scheduled] → tick → adapter.validate(bytes, caption)
        ├─ ok → adapter.publish → [published] externalId
        └─ fail → [rejected] reasons[]  (publish_attempts row either way)
  → simulator → ingest → metrics (normalised)
  → compare (like-for-like) · facts → report(claims+postIds) → verify → insights
  → insights shown + injected into next Brief  ⟲
```

## Variant state machine (`lib/domain/status.ts`)
```
draft ──approve──▶ approved ──schedule──▶ scheduled ──tick──▶ published
  │  ▲                │ (edit)                  └──tick(invalid)──▶ rejected
  │  └──regenerate────┤
  └──discard(note)──▶ discarded ──regenerate──▶ new draft (version+1, parentId)
approved ──edit──▶ draft (approval cleared)
rejected ──edit──▶ draft
```
Any other transition throws `IllegalTransitionError`. `schedule()` also re-checks `approval.contentHash === hash(copy, assetUrl, assetSha256)`.

## Schema (Drizzle, `src/db/schema.ts`)
| table | key columns |
|---|---|
| `briefs` | id, title, show, keyMessage, audience, languages(json), tone, ctaGoal, rawText, briefLang, appliedInsightIds(json), createdAt |
| `concepts` | id, briefId, name — one creative concept shared across channels (the like-for-like key) |
| `variants` | id (`P-0001` style public postId), conceptId, channel(`instagram`\|`x`\|`youtube`), lang(`bn`\|`en`), format(`image`\|`video`), caption, hashtags(json), cta, hook, planJson, imagePrompt, assetUrl, assetSha256, width, height, bytes, durationSec, criticJson, status, version, parentId, discardNote, createdAt |
| `approvals` | id, variantId, approver, contentHash, approvedAt, revokedAt |
| `schedules` | id, variantId, scheduledFor, createdAt |
| `publish_attempts` | id, variantId, attemptedAt, ok, externalId, reasons(json) |
| `metrics` | id, variantId, capturedAt, impressions, reach, likes, comments, shares, saves, views, watchTimeSec, clicks, rawJson |
| `reports` | id, weekStart, claimsJson, verified, markdown, createdAt |
| `insights` | id, reportId, statement, evidencePostIds(json), lever(`lang`\|`channel`\|`cta`\|`time`\|`format`\|`hook`), recommendation, active |
| `ai_calls` | id, provider, model, purpose, inTokens, outTokens, costUsd, ms, ok, createdAt |
| `app_clock` | id=1, offsetMs — demo time travel |

## Normalised rates (used everywhere comparisons happen)
- `engagementRate = (likes+comments+shares+saves) / impressions`
- `shareRate = shares / impressions` · `saveRate = saves / impressions`
- video: `completionProxy = watchTimeSec / (views × durationSec)`
Compare on rates, never on raw totals across platforms.

## Deploy
Vercel (Hobby). Env: see `.env.example`. DB = Turso, assets = Vercel Blob. There is no background worker: the scheduler tick runs on `/queue` load and via the "advance clock" control. Vercel Cron (daily) is only a safety net.
