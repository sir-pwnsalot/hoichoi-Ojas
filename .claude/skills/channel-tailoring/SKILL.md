---
name: channel-tailoring
description: Use when building the per-channel creative plan, image prompts, canvas/video composition, or channel copy rules for Instagram, X and YouTube Shorts. Ensures variants genuinely differ per channel (not crops) and proves it.
---

# Per-channel tailoring

Auto-disqualifier: "one generated image cropped/relabeled per platform and called tailored". Tailoring happens at **plan time**, before any pixels exist.

## Creative plan (one LLM call per brief → Zod schema)
```ts
{ concept: { name, coreIdea },
  channels: { instagram|x|youtube: {
    format: "image"|"video", angle, hookStyle, tone, lengthTarget,
    ctaType: "comment-question"|"tag-a-friend"|"watch-now"|"reply"|"subscribe"|"link",
    hashtagStrategy, composition, imagePrompt, overlayText: { bn, en } } },
  appliedInsights: [{ insightId, howApplied }] }
```
Each channel's `imagePrompt` must describe a **different shot** (subject framing, camera distance, layout). Enforce it in the prompt, and verify it after generation with dHash.

## Channel matrix
| | Instagram (feed) | X | YouTube Shorts |
|---|---|---|---|
| Format | image 4:5, 1080×1350 | image 16:9, 1600×900 | video 9:16, 1080×1920, 8–12 s |
| Shot | tight character close-up, emotion, shallow depth | wide cinematic establishing shot, negative space on the left third for the headline | vertical, subject centred, strong motion hook in the first 1.5 s |
| Overlay | short hook, lower third, brand bug top-right | headline in the left-third space, big type | animated captions in the safe zone (avoid top 12%, bottom 20% for UI) |
| Copy length | hook ≤125 chars (before "more"), caption 150–400 | ≤ 200 weighted chars target (limit 280) | title ≤ 100 chars, short description |
| Tone | warm, emotive, community | punchy, witty, conversational | curiosity-gap, fast |
| CTA | comment question / tag a friend | reply / quote-post | "watch full series" / subscribe |
| Hashtags | 3–5 mixed | 1–2 | 2–3 incl. #Shorts |

## Image generation
- Generate at the **native size per channel**. Flux via Cloudflare accepts width/height; if a provider only does fixed ratios, pick the closest *native* ratio and generate. Never generate one image and crop it.
- Prompts: cinematic, Kolkata-specific visual cues (north-Kolkata lanes, old mansions, trams, rain) when relevant. **No text in the image.** Add "no text, no letters, no watermark" to every prompt.
- Store `imagePrompt`, provider, seed and size on the variant, and show all 3 prompts side by side on the review screen.

## Composition (browser)
- `CanvasComposer`: draws base image + gradient scrim + overlay text (bn: Noto Sans Bengali / Hind Siliguri; en: brand sans) + brand bug. Layout per channel from the matrix. Export PNG and upload.
- `VideoComposer`: 9:16 canvas, 2–3 frames (Shorts gets its own vertical generation, plus optionally 1–2 extra vertical frames), Ken Burns pan/zoom, captions animating in word by word, 24–30 fps, `MediaRecorder` with `video/mp4` if `isTypeSupported`, else WebM. Record the real duration and upload.
- Load fonts with `document.fonts.load()` before drawing, or Bengali renders as tofu (blank boxes).

## Proof of tailoring (`lib/ai/tailoring.ts`)
- Compute a 64-bit dHash per asset (for video: the first frame, downscaled). Hamming similarity > 0.85 between any two channels of the same concept → flag and regenerate.
- Review screen shows: the similarity %, the 3 prompts, and a copy diff table (length, CTA type, hashtag count, tone).
