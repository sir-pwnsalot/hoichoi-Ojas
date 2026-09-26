import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  buildTailoringReport,
  dHash,
  hammingDistance,
  isTooSimilar,
  similarity,
  SIMILARITY_THRESHOLD,
} from "@/lib/ai/tailoring";
import { scene } from "./fixtures";

describe("dHash tailoring check", () => {
  it("produces a 64-bit (16 hex char) hash, stable across re-encodes", async () => {
    const png = await scene("street", 1600, 900);
    const jpg = await sharp(png).jpeg({ quality: 80 }).toBuffer();
    const a = await dHash(png);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(similarity(a, await dHash(jpg))).toBeGreaterThan(0.95);
  });

  it("flags a crop of the same image (> 0.85)", async () => {
    const master = await scene("street", 1600, 900);
    const crop = await sharp(master).extract({ left: 60, top: 30, width: 1480, height: 840 }).toBuffer();
    const a = await dHash(master);
    const b = await dHash(crop);
    expect(similarity(a, b)).toBeGreaterThan(SIMILARITY_THRESHOLD);
    expect(isTooSimilar(a, b)).toBe(true);
  });

  it("flags a resize of the same image", async () => {
    const master = await scene("street", 1600, 900);
    const small = await sharp(master).resize(800, 450).toBuffer();
    expect(isTooSimilar(await dHash(master), await dHash(small))).toBe(true);
  });

  it("does not flag two different images", async () => {
    const a = await dHash(await scene("street", 1600, 900));
    const b = await dHash(await scene("portrait", 1080, 1350));
    expect(similarity(a, b)).toBeLessThanOrEqual(SIMILARITY_THRESHOLD);
    expect(isTooSimilar(a, b)).toBe(false);
  });

  it("handles images with an alpha channel", async () => {
    const withAlpha = await sharp(await scene("portrait", 400, 500)).ensureAlpha().png().toBuffer();
    expect(await dHash(withAlpha)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("hamming distance counts differing bits", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(hammingDistance("0000000000000000", "0000000000000003")).toBe(2);
  });

  it("builds a per-concept report with the max similarity per channel pair", () => {
    const report = buildTailoringReport({
      instagram: ["0000000000000000"],
      x: ["0000000000000001", "ffffffffffffffff"], // best match 63/64 -> flagged
      youtube: ["00000000ffffffff"], // 32/64
    });
    expect(report.pairs).toHaveLength(3);
    const igX = report.pairs.find((p) => p.a === "instagram" && p.b === "x")!;
    expect(igX.similarity).toBeCloseTo(63 / 64);
    expect(igX.flagged).toBe(true);
    const igYt = report.pairs.find((p) => p.a === "instagram" && p.b === "youtube")!;
    expect(igYt.similarity).toBeCloseTo(0.5);
    expect(igYt.flagged).toBe(false);
    expect(report.flagged).toBe(true);
    expect(report.maxSimilarity).toBeCloseTo(63 / 64);
  });
});
