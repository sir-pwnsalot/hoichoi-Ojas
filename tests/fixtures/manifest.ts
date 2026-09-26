import { synthImage, synthMp4, synthNoisePng } from "@/lib/media/synth";

// Every fixture the adapter tests use. Generated (never hand-edited) by
// `npm run fixtures` or automatically by tests/setup/global.ts when missing.
// *-oversize.* files are gitignored (multi-MB); everything else is committed.
export const FIXTURES: Record<string, () => Promise<Uint8Array> | Uint8Array> = {
  "ig-valid.png": () => synthImage(1080, 1350, "png"),
  "ig-valid.jpg": () => synthImage(1080, 1080, "jpeg"),
  "ig-portrait-916.png": () => synthImage(1080, 1920, "png"), // 9:16 < 4:5 → ASPECT_RATIO
  "ig-small.png": () => synthImage(720, 900, "png"), // 4:5 but < 1080 wide → DIMENSIONS
  "ig-valid.webp": () => synthImage(1080, 1350, "webp"), // IG takes JPEG/PNG only → FORMAT
  "ig-oversize.png": () => synthNoisePng(1720, 2150, 7), // ~11 MB, otherwise valid → FILE_TOO_LARGE
  "x-valid.png": () => synthImage(1600, 900, "png"),
  "x-square.png": () => synthImage(1080, 1080, "png"), // → ASPECT_RATIO
  "x-tiny.png": () => synthImage(480, 270, "png"), // 16:9 but < 600×335 → DIMENSIONS
  "x-oversize.png": () => synthNoisePng(1920, 1080, 11), // ~6 MB → FILE_TOO_LARGE
  "yt-valid.mp4": () => synthMp4(1080, 1920, 10),
  "yt-square.mp4": () => synthMp4(1080, 1080, 10), // → ASPECT_RATIO + DIMENSIONS
  "yt-lowres.mp4": () => synthMp4(720, 1280, 10), // 9:16 but < 1080×1920 → DIMENSIONS
  "yt-long.mp4": () => synthMp4(1080, 1920, 75), // → DURATION
  "yt-short.mp4": () => synthMp4(1080, 1920, 2), // → DURATION
  "yt-frame.png": () => synthImage(1080, 1920, "png"), // image to a video channel → FORMAT
  // EBML header only: a WebM (what Chrome's MediaRecorder emits by default) → FORMAT
  "yt-clip.webm": () => new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]),
};
