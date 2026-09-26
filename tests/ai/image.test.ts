import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aspectMatches,
  cfModelSpec,
  fitToModel,
  generateImage,
  ImageGenerationError,
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

describe("Cloudflare model fitting", () => {
  it("keeps generation sizes unchanged on width/height models", () => {
    for (const ch of ["instagram", "x", "youtube"] as Channel[]) {
      const g = GENERATION_SIZE[ch];
      expect(fitToModel(g.width, g.height, cfModelSpec("@cf/lykon/dreamshaper-8-lcm"))).toEqual(g);
    }
  });

  it("scales oversize requests into the model's range at the same aspect", () => {
    const fitted = fitToModel(1080, 1920 * 2, cfModelSpec("@cf/bytedance/stable-diffusion-xl-lightning"));
    expect(fitted.height).toBeLessThanOrEqual(2048);
    expect(fitted.width % 8).toBe(0);
    expect(aspectMatches(fitted.width, fitted.height, 1080, 3840)).toBe(true);
  });

  it("rejects square-only flux-1-schnell for non-square sizes with a config error", () => {
    const spec = cfModelSpec("@cf/black-forest-labs/flux-1-schnell");
    expect(spec.squareOnly).toBe(true);
    expect(() => fitToModel(1024, 1280, spec)).toThrow(/only outputs 1:1/);
  });

  it("throws when the aspect can't fit the model's box", () => {
    expect(() => fitToModel(4000, 100, cfModelSpec("@cf/lykon/dreamshaper-8-lcm"))).toThrow(/cannot fit/);
  });
});

describe("generateImage failure reporting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("labels a 429 as rate-limited and a square-only model as a config error", async () => {
    vi.stubEnv("IMAGE_PROVIDER_ORDER", "cloudflare,pollinations");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CF_IMAGE_MODEL", "@cf/black-forest-labs/flux-1-schnell");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("queue full", { status: 429 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = await generateImage({ prompt: `rate-limit test ${Math.random()}`, width: 1024, height: 1280 }).catch((e) => e);
    expect(err).toBeInstanceOf(ImageGenerationError);
    const failures = (err as ImageGenerationError).failures;
    expect(failures.map((f) => [f.provider, f.kind])).toEqual([
      ["cloudflare", "config"],
      ["pollinations", "rate_limited"],
    ]);
    expect((err as Error).message).toMatch(/cloudflare \[CONFIG ERROR\].*dreamshaper-8-lcm/);
    expect((err as Error).message).toMatch(/pollinations \[RATE LIMITED\]: rate limited, will retry next call/);
    expect((err as Error).message).not.toMatch(/Flux 2/);
    expect((err as ImageGenerationError).onlyRateLimited).toBe(false);
  });
});
