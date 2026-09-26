import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { probeAsset, UnsupportedAssetError } from "@/lib/media/probe";
import { scene } from "../ai/fixtures";

describe("probeAsset reads facts from the bytes", () => {
  it("PNG: dimensions, size and sha256", async () => {
    const png = await scene("portrait", 1080, 1350);
    const p = await probeAsset(new Uint8Array(png));
    expect(p).toMatchObject({
      format: "png",
      mime: "image/png",
      width: 1080,
      height: 1350,
      bytes: png.length,
      durationSec: null,
    });
    expect(p.sha256).toBe(createHash("sha256").update(png).digest("hex"));
  });

  it("JPEG detected by magic bytes, not by name", async () => {
    const jpg = await sharp(await scene("street", 1600, 900)).jpeg().toBuffer();
    expect(await probeAsset(new Uint8Array(jpg))).toMatchObject({ format: "jpeg", width: 1600, height: 900 });
  });

  it("rejects unknown bytes", async () => {
    await expect(probeAsset(new TextEncoder().encode("hello, not an image"))).rejects.toBeInstanceOf(
      UnsupportedAssetError,
    );
  });

  it("rejects a garbage MP4", async () => {
    const fake = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypisom"), 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(probeAsset(fake)).rejects.toBeInstanceOf(UnsupportedAssetError);
  });
});
