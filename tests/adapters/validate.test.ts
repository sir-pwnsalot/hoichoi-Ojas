import { describe, expect, it } from "vitest";
import { validateAgainstSpec, captionLength, countHashtags, countGraphemes } from "@/lib/adapters/validate";
import { SPECS } from "@/lib/adapters/specs";
import type { Channel, PublishPayload, RejectionCode } from "@/lib/adapters/types";
import { fixture } from "../fixtures/load";

function payload(over: Partial<PublishPayload> = {}): PublishPayload {
  return { variantId: "P-TEST", caption: "Tonight. #hoichoi", hashtags: ["#hoichoi"], asset: { url: "/x" }, ...over };
}

async function codes(channel: Channel, file: string | null, over: Partial<PublishPayload> = {}): Promise<RejectionCode[]> {
  const p = payload({ title: channel === "youtube" ? "Episode 5 tonight" : undefined, ...over });
  const res = await validateAgainstSpec(channel, p, file ? fixture(file) : null);
  return res.ok ? [] : res.rejections.map((r) => r.code).sort();
}

describe("valid assets pass on every channel", () => {
  it.each([
    ["instagram", "ig-valid.png"],
    ["instagram", "ig-valid.jpg"],
    ["x", "x-valid.png"],
    ["youtube", "yt-valid.mp4"],
  ] as const)("%s ← %s", async (channel, file) => {
    const res = await validateAgainstSpec(channel, payload({ title: "Ep 5" }), fixture(file));
    expect(res.ok, JSON.stringify(res)).toBe(true);
    if (res.ok) expect(res.probe.bytes).toBe(fixture(file).byteLength);
  });
});

describe("byte-level asset rules — each returns the exact code", () => {
  it("ASPECT_RATIO: 9:16 image to Instagram", async () => {
    expect(await codes("instagram", "ig-portrait-916.png")).toEqual(["ASPECT_RATIO"]);
  });
  it("ASPECT_RATIO: 1:1 image to X", async () => {
    expect(await codes("x", "x-square.png")).toEqual(["ASPECT_RATIO"]);
  });
  it("ASPECT_RATIO + DIMENSIONS: 1:1 video to Shorts (collects ALL rejections)", async () => {
    expect(await codes("youtube", "yt-square.mp4")).toEqual(["ASPECT_RATIO", "DIMENSIONS"]);
  });
  it("DIMENSIONS: 720 wide to Instagram / 480×270 to X / 720×1280 to Shorts", async () => {
    expect(await codes("instagram", "ig-small.png")).toEqual(["DIMENSIONS"]);
    expect(await codes("x", "x-tiny.png")).toEqual(["DIMENSIONS"]);
    expect(await codes("youtube", "yt-lowres.mp4")).toEqual(["DIMENSIONS"]);
  });
  it("FILE_TOO_LARGE: 11 MB PNG to Instagram, size measured from the bytes", async () => {
    const res = await validateAgainstSpec("instagram", payload(), fixture("ig-oversize.png"));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rejections.map((r) => r.code)).toEqual(["FILE_TOO_LARGE"]);
    expect(res.rejections[0].actual).toMatch(/MB/);
    expect(res.probe?.bytes).toBe(fixture("ig-oversize.png").byteLength);
  });
  it("FILE_TOO_LARGE: 6 MB PNG to X", async () => {
    expect(await codes("x", "x-oversize.png")).toEqual(["FILE_TOO_LARGE"]);
  });
  it("FORMAT: WebP to Instagram, PNG to Shorts, WebM to Shorts, garbage bytes, missing asset", async () => {
    expect(await codes("instagram", "ig-valid.webp")).toEqual(["FORMAT"]);
    expect(await codes("youtube", "yt-frame.png")).toContain("FORMAT");
    expect(await codes("youtube", "yt-clip.webm")).toContain("FORMAT");
    const garbage = await validateAgainstSpec("x", payload(), new TextEncoder().encode("not an image"));
    expect(garbage.ok ? [] : garbage.rejections.map((r) => r.code)).toEqual(["FORMAT"]);
    expect(await codes("x", null)).toEqual(["FORMAT"]);
  });
  it("DURATION: 75 s and 2 s clips to Shorts", async () => {
    expect(await codes("youtube", "yt-long.mp4")).toEqual(["DURATION"]);
    expect(await codes("youtube", "yt-short.mp4")).toEqual(["DURATION"]);
  });
  it("a file named .png is judged by its bytes (MP4 bytes → Instagram = FORMAT)", async () => {
    const res = await validateAgainstSpec("instagram", payload({ asset: { url: "/uploads/fake.png" } }), fixture("yt-valid.mp4"));
    expect(res.ok ? [] : res.rejections.map((r) => r.code)).toContain("FORMAT");
  });
});

describe("caption rules", () => {
  it("counts graphemes, not UTF-16 units (Bengali conjuncts + emoji)", () => {
    expect("ক্ষ".length).toBe(3);
    expect(countGraphemes("ক্ষ")).toBe(1);
    expect(countGraphemes("👨‍👩‍👧")).toBe(1);
  });

  it("X uses twitter-text weighted length: emoji counts 2, URL counts 23", () => {
    expect(captionLength(SPECS.x, "😀")).toBe(2);
    expect(captionLength(SPECS.x, "https://www.hoichoi.tv/shows/some-very-long-path-for-the-series")).toBe(23);
  });

  it("CAPTION_TOO_LONG: Bengali + emoji X post over 280 weighted", async () => {
    const caption = "আজ রাতে নতুন পর্ব, মিস করবেন না! 🔥🎬 ".repeat(8) + "#hoichoi";
    expect(captionLength(SPECS.x, caption)).toBeGreaterThan(280);
    const res = await validateAgainstSpec("x", payload({ caption }), fixture("x-valid.png"));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const r = res.rejections.find((x) => x.code === "CAPTION_TOO_LONG")!;
    expect(r).toMatchObject({ field: "text", limit: 280 });
    expect(r.actual).toBe(captionLength(SPECS.x, caption));
  });

  it("Instagram: Bengali+emoji caption within 2200 graphemes passes even though .length > 2200", async () => {
    const unit = "ক্ষুধার্ত 🔥 "; // few graphemes, many code units
    const caption = unit.repeat(Math.floor(2200 / countGraphemes(unit)));
    expect(caption.length).toBeGreaterThan(2200);
    expect(countGraphemes(caption)).toBeLessThanOrEqual(2200);
    expect(await codes("instagram", "ig-valid.png", { caption })).toEqual([]);
  });

  it("CAPTION_TOO_LONG: Bengali+emoji Instagram caption over 2200 graphemes", async () => {
    const caption = "দুর্দান্ত 🎬 ".repeat(400);
    expect(countGraphemes(caption)).toBeGreaterThan(2200);
    expect(await codes("instagram", "ig-valid.png", { caption })).toEqual(["CAPTION_TOO_LONG"]);
  });

  it("CAPTION_TOO_LONG on the Shorts description (> 5000)", async () => {
    expect(await codes("youtube", "yt-valid.mp4", { caption: "ক".repeat(5001) })).toEqual(["CAPTION_TOO_LONG"]);
  });

  it("TITLE_TOO_LONG: Shorts title over 100 graphemes", async () => {
    expect(await codes("youtube", "yt-valid.mp4", { title: "এপিসোড ৫ ".repeat(20) })).toEqual(["TITLE_TOO_LONG"]);
  });

  it("TOO_MANY_HASHTAGS counts tags in the caption text, not the hashtags array", async () => {
    const caption = "Tonight #hoichoi #বাংলা_সিরিজ #thriller #kolkata";
    expect(countHashtags(caption)).toBe(4);
    expect(await codes("x", "x-valid.png", { caption, hashtags: [] })).toEqual(["TOO_MANY_HASHTAGS"]);
    // the array alone never trips it
    expect(await codes("x", "x-valid.png", { caption: "Tonight", hashtags: ["#a", "#b", "#c", "#d", "#e"] })).toEqual([]);
  });

  it("TOO_MANY_HASHTAGS on Instagram (> 30)", async () => {
    const caption = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ");
    expect(await codes("instagram", "ig-valid.png", { caption })).toEqual(["TOO_MANY_HASHTAGS"]);
  });

  it("EMPTY_CAPTION: whitespace caption, and missing Shorts title", async () => {
    expect(await codes("x", "x-valid.png", { caption: "  \n " })).toEqual(["EMPTY_CAPTION"]);
    const res = await validateAgainstSpec("youtube", payload({ title: "" }), fixture("yt-valid.mp4"));
    expect(res.ok ? [] : res.rejections.map((r) => [r.code, r.field])).toEqual([["EMPTY_CAPTION", "title"]]);
  });

  it("collects every violation at once (asset + caption + hashtags)", async () => {
    const caption = "x".repeat(300) + " #a #b #c #d";
    expect(await codes("x", "x-square.png", { caption })).toEqual(["ASPECT_RATIO", "CAPTION_TOO_LONG", "TOO_MANY_HASHTAGS"]);
  });
});
