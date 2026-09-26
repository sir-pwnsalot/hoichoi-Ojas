import { describe, expect, it } from "vitest";
import {
  aspectMatches,
  GENERATION_SIZE,
  imageCacheKey,
  NATIVE_SIZE,
  NO_TEXT_SUFFIX,
  withNoText,
} from "@/lib/ai/image";
import type { Channel } from "@/lib/types";

describe("image.ts helpers", () => {
  it("always appends the no-text suffix exactly once", () => {
    expect(withNoText("rainy Kolkata lane")).toBe(`rainy Kolkata lane, ${NO_TEXT_SUFFIX}`);
    expect(withNoText("rainy Kolkata lane, no text, no letters, no watermark")).toBe(
      `rainy Kolkata lane, ${NO_TEXT_SUFFIX}`,
    );
    expect(withNoText("tram at dusk. No text, no letters, no watermark.")).toBe(`tram at dusk, ${NO_TEXT_SUFFIX}`);
  });

  it("generation sizes keep each channel's native aspect (no cross-aspect crops)", () => {
    for (const ch of ["instagram", "x", "youtube"] as Channel[]) {
      const g = GENERATION_SIZE[ch];
      const n = NATIVE_SIZE[ch];
      expect(g.width % 16).toBe(0);
      expect(g.height % 16).toBe(0);
      expect(aspectMatches(g.width, g.height, n.width, n.height)).toBe(true);
    }
  });

  it("rejects wrong-aspect provider output", () => {
    expect(aspectMatches(1024, 1024, 1536, 864)).toBe(false);
    expect(aspectMatches(1536, 864, 1600, 900)).toBe(true);
  });

  it("cache key depends on prompt, size and seed", () => {
    const k = imageCacheKey("p", 10, 20, 1);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(imageCacheKey("p", 10, 20, 1)).toBe(k);
    expect(imageCacheKey("p", 10, 20, 2)).not.toBe(k);
    expect(imageCacheKey("p", 20, 10, 1)).not.toBe(k);
    expect(imageCacheKey("q", 10, 20, 1)).not.toBe(k);
  });
});
