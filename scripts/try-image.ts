// Smoke test for the image chain: `npx tsx --env-file=.env.local scripts/try-image.ts [channel]`
// Prints provider, measured size, cache hit and dHash; never prints keys.
import { GENERATION_SIZE, generateImage } from "@/lib/ai/image";
import { dHash } from "@/lib/ai/tailoring";
import type { Channel } from "@/lib/types";

async function main() {
  const channel = (process.argv[2] ?? "x") as Channel;
  const { width, height } = GENERATION_SIZE[channel];
  const prompt = "cinematic wide shot of a rainy north Kolkata lane at dusk, yellow taxi, old mansion balconies";
  for (const run of [1, 2]) {
    const t = Date.now();
    const img = await generateImage({ prompt, width, height });
    console.log(
      `run ${run}: ${img.provider} ${img.width}x${img.height} ${img.mime} cached=${img.cached} ` +
        `seed=${img.seed} dhash=${await dHash(img.bytes)} url=${img.url} ${Date.now() - t}ms`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
