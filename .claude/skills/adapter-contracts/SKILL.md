---
name: adapter-contracts
description: Use when working on mock channel adapters, platform specs, byte-level validation, the scheduler/publish flow, publish-attempt logging, or the rule-breaker demo. The adapter must reject constraint violations, never silently accept or auto-fix them.
---

# Adapter contracts

"Toughest test": a post that violates a platform constraint is submitted to the adapter layer and **must be rejected, not silently accepted**.

## Interface (`lib/adapters/types.ts`)
```ts
type Channel = "instagram" | "x" | "youtube";
type RejectionCode = "NOT_APPROVED" | "ASPECT_RATIO" | "DIMENSIONS" | "FILE_TOO_LARGE" | "FORMAT"
  | "DURATION" | "CAPTION_TOO_LONG" | "TITLE_TOO_LONG" | "TOO_MANY_HASHTAGS" | "EMPTY_CAPTION";
interface Rejection { code: RejectionCode; field: string; limit: string | number; actual: string | number; message: string }
interface PublishPayload { variantId: string; caption: string; title?: string; hashtags: string[]; asset: { url: string } }
interface ChannelAdapter {
  channel: Channel;
  validate(p: PublishPayload): Promise<{ ok: true; probe: AssetProbe } | { ok: false; rejections: Rejection[] }>;
  publish(p: PublishPayload): Promise<{ externalId: string; publishedAt: Date }>; // calls validate() itself first
}
```
- `publish()` **always** calls `validate()` itself. Never trust that the caller did.
- Collect **all** rejections, not just the first one.
- Every call writes a `publish_attempts` row (ok, reasons, externalId).
- The scheduler also re-checks the approval hash before calling the adapter (`NOT_APPROVED`).

## Probing the real bytes (`lib/adapters/validate.ts`)
- Fetch the asset bytes from its URL. Size = `byteLength` of the bytes, never a DB field.
- Images: `image-size` (pure JS) for width/height/type. Video: `mp4box` to parse `moov` for width/height/duration. Anything that isn't MP4 is rejected as `FORMAT` for video channels.
- Aspect ratio tolerance ±1%.
- Caption length: X uses `twitter-text` `parseTweet().weightedLength` (emoji count 2; URLs 23). Other channels count grapheme clusters with `Intl.Segmenter`, not `.length`. Bengali combining marks make `.length` wrong.
- Hashtags are counted from the final caption text, not from the hashtags array.

## Mock specs (`lib/adapters/specs.ts`). Show this table in the UI, labelled "mock spec based on public platform limits".
| | Instagram (feed image) | X (image post) | YouTube Shorts |
|---|---|---|---|
| Formats | JPEG, PNG | JPEG, PNG, WEBP | MP4 |
| Aspect | 4:5 … 1.91:1 | 16:9 or 1:1 (ours: 16:9) | 9:16 |
| Min dims | 1080 wide | 600×335 | 1080×1920 |
| Max file | 8 MB | 5 MB | 100 MB (mock) |
| Duration | – | – | 3–60 s (mock) |
| Caption | ≤ 2200 chars | ≤ 280 weighted | title ≤ 100, description ≤ 5000 |
| Hashtags | ≤ 30 | ≤ 3 (house rule) | ≤ 15 (house rule) |

## Tests (`tests/adapters/*.test.ts`) — write these before the UI
Fixtures in `tests/fixtures/`: a valid asset for each channel plus one for each violation (make them with `sharp` in a fixture script, dev-only). Cases: wrong ratio, oversize, too-long caption (with Bengali + emoji), too many hashtags, non-MP4 video, too-long video, unapproved variant. Each expects the exact `code`.

## Rule-breaker demo panel (`/queue`)
Three prebuilt bad payloads (1:1 video → Shorts, 11 MB PNG → IG, 310-char post → X), plus "submit custom". Show the rejection cards with limit vs actual, and the attempt log.

## Mock publish
`externalId` = `ig_`/`x_`/`yt_` + a short random string. `publishedAt` = app clock (`app_clock.offsetMs` applied). Publishing kicks off the simulator schedule for that post (see `demo-seed`).
