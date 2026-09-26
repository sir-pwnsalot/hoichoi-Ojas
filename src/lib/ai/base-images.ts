import { GENERATION_SIZE, generateImage, stripNoText, withNoText } from "@/lib/ai/image";
import { buildTailoringReport, dHash } from "@/lib/ai/tailoring";
import type { Channel, TailoringReport } from "@/lib/types";

// Per-channel base images for one concept: each channel's own prompt at its
// own native aspect (Shorts gets 2–3 vertical frames for the Ken Burns clip),
// then the dHash tailoring check. A pair above the threshold is regenerated
// with a new seed and a stronger framing push, up to MAX_RETRIES times.

export interface ChannelBaseImages {
  urls: string[];
  provider: string | null;
  seed: number | null;
  dhash: string | null; // of frame 0
  prompt: string; // exact prompt used (incl. the no-text suffix)
}

const MAX_RETRIES = 2;

// Extra Shorts frames: same scene, different vertical framings.
const SHORTS_EXTRA_FRAMES = [
  "extreme close-up detail shot of the same scene, vertical framing, subject centred",
  "wide vertical establishing shot of the same scene, low angle, strong depth",
];

const REFRAME_HINT: Record<Channel, string> = {
  instagram: "tight emotional close-up on a face, shallow depth of field",
  x: "very wide cinematic establishing shot, subject small on the right, empty negative space on the left third",
  youtube: "vertical full-body shot, subject centred, dynamic motion",
};

async function generateFrames(channel: Channel, prompt: string, seed?: number): Promise<ChannelBaseImages> {
  const { width, height } = GENERATION_SIZE[channel];
  const main = await generateImage({ prompt, width, height, seed });
  const urls = [main.url];
  if (channel === "youtube") {
    for (const [i, extra] of SHORTS_EXTRA_FRAMES.entries()) {
      try {
        const frame = await generateImage({ prompt: `${stripNoText(prompt)}, ${extra}`, width, height, seed: main.seed + i + 1 });
        urls.push(frame.url);
      } catch (err) {
        // 2 frames is still a valid clip; only the main frame is required.
        console.error(`[base-images] shorts frame ${i + 2} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }
  return { urls, provider: main.provider, seed: main.seed, dhash: await dHash(main.bytes), prompt: withNoText(prompt) };
}

export async function generateConceptBaseImages(
  prompts: Record<Channel, string>,
): Promise<{ images: Record<Channel, ChannelBaseImages>; tailoring: TailoringReport | null }> {
  const channels: Channel[] = ["instagram", "x", "youtube"];
  // Channels run in parallel (Workers AI latency is 15–60 s per image, and a
  // campaign must fit in one Vercel function run); Shorts frames are sequential.
  const results = await Promise.all(
    channels.map(async (channel): Promise<ChannelBaseImages> => {
      try {
        return await generateFrames(channel, prompts[channel]);
      } catch (err) {
        console.error(`[base-images] ${channel} failed:`, err instanceof Error ? err.message : err);
        return { urls: [], provider: null, seed: null, dhash: null, prompt: withNoText(prompts[channel]) };
      }
    }),
  );
  const images = Object.fromEntries(channels.map((c, i) => [c, results[i]])) as Record<Channel, ChannelBaseImages>;

  let tailoring = reportFor(images);
  for (let attempt = 1; tailoring?.flagged && attempt <= MAX_RETRIES; attempt++) {
    // Regenerate the second channel of each flagged pair.
    const redo = new Set(tailoring.pairs.filter((p) => p.flagged).map((p) => p.b));
    for (const channel of redo) {
      const prev = images[channel];
      const prompt = `${stripNoText(prompts[channel])}, ${REFRAME_HINT[channel]}`;
      try {
        images[channel] = await generateFrames(channel, prompt, (prev.seed ?? 0) + 1000 * attempt);
      } catch (err) {
        console.error(`[base-images] ${channel} retry ${attempt} failed:`, err instanceof Error ? err.message : err);
      }
    }
    tailoring = reportFor(images);
  }
  return { images, tailoring };
}

function reportFor(images: Record<Channel, ChannelBaseImages>): TailoringReport | null {
  const hashes: Partial<Record<Channel, string[]>> = {};
  for (const [channel, img] of Object.entries(images) as [Channel, ChannelBaseImages][]) {
    if (img.dhash) hashes[channel] = [img.dhash];
  }
  return Object.keys(hashes).length >= 2 ? buildTailoringReport(hashes) : null;
}
