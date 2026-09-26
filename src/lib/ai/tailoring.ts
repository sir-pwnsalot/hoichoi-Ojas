import sharp from "sharp";
import type { Channel, SimilarityPair, TailoringReport } from "@/lib/types";

// Proof of per-channel tailoring (non-negotiable #1): a 64-bit difference
// hash per visual; two channels of the same concept whose hashes are more
// than 85% similar are a crop/relabel, not a tailored variant.

export const SIMILARITY_THRESHOLD = 0.85;

// 9×8 greyscale, each bit = "pixel brighter than its right neighbour".
export async function dHash(bytes: Uint8Array): Promise<string> {
  const { data: px, info } = await sharp(bytes)
    .removeAlpha()
    .greyscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`dHash expected 1 channel, got ${info.channels}`);
  let bits = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      bits += px[row * 9 + col] > px[row * 9 + col + 1] ? "1" : "0";
    }
  }
  // 16 hex chars, 4 bits at a time (no BigInt: tsconfig targets < ES2020).
  return bits.replace(/[01]{4}/g, (nibble) => parseInt(nibble, 2).toString(16));
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error("dHash length mismatch");
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export function similarity(a: string, b: string): number {
  return 1 - hammingDistance(a, b) / 64;
}

export function isTooSimilar(a: string, b: string): boolean {
  return similarity(a, b) > SIMILARITY_THRESHOLD;
}

// hashes: one or more dHashes per channel (e.g. bn + en composed assets).
// A channel pair's similarity is the max over all cross-channel hash pairs.
export function buildTailoringReport(hashes: Partial<Record<Channel, string[]>>): TailoringReport {
  const channels = (Object.keys(hashes) as Channel[]).filter((c) => (hashes[c]?.length ?? 0) > 0);
  const pairs: SimilarityPair[] = [];
  for (let i = 0; i < channels.length; i++) {
    for (let j = i + 1; j < channels.length; j++) {
      const a = channels[i];
      const b = channels[j];
      let max = 0;
      for (const ha of hashes[a]!) for (const hb of hashes[b]!) max = Math.max(max, similarity(ha, hb));
      pairs.push({ a, b, similarity: max, flagged: max > SIMILARITY_THRESHOLD });
    }
  }
  const maxSimilarity = pairs.reduce((m, p) => Math.max(m, p.similarity), 0);
  return {
    threshold: SIMILARITY_THRESHOLD,
    pairs,
    maxSimilarity,
    flagged: pairs.some((p) => p.flagged),
    computedAt: new Date().toISOString(),
  };
}
