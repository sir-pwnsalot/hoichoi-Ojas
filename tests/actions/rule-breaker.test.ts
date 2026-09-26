import { describe, expect, it } from "vitest";
import { listPublishAttempts, submitRuleBreaker } from "@/lib/actions/publish";

const codes = (r: { rejections: { code: string }[] }) => r.rejections.map((x) => x.code).sort();

describe("submitRuleBreaker — real bytes through the real adapters", () => {
  it("1:1 video → Shorts is rejected (ASPECT_RATIO + DIMENSIONS)", async () => {
    const r = await submitRuleBreaker("wrong_ratio_video");
    expect(r.ok).toBe(false);
    expect(codes(r)).toEqual(["ASPECT_RATIO", "DIMENSIONS"]);
    expect(r.rejections.find((x) => x.code === "ASPECT_RATIO")).toMatchObject({ limit: "9:16" });
  });

  it("11 MB PNG → Instagram is rejected (FILE_TOO_LARGE)", async () => {
    const r = await submitRuleBreaker("oversized_image");
    expect(codes(r)).toEqual(["FILE_TOO_LARGE"]);
  }, 60_000);

  it("310-char post → X is rejected (CAPTION_TOO_LONG, actual 310)", async () => {
    const r = await submitRuleBreaker("long_caption");
    expect(codes(r)).toEqual(["CAPTION_TOO_LONG"]);
    expect(r.rejections[0]).toMatchObject({ limit: 280, actual: 310 });
  });

  it("custom payload: Bengali + emoji caption and 5 hashtags to X", async () => {
    const caption = "নতুন পর্ব আজ রাতে 🔥 ".repeat(20) + "#a #b #c #d #e";
    const r = await submitRuleBreaker("custom", { channel: "x", caption });
    expect(codes(r)).toEqual(["CAPTION_TOO_LONG", "TOO_MANY_HASHTAGS"]);
  });

  it("custom payload that is valid is accepted (the adapter isn't just saying no)", async () => {
    const r = await submitRuleBreaker("custom", { channel: "instagram", caption: "আজ রাত ৯টায় #hoichoi" });
    expect(r).toMatchObject({ ok: true, rejections: [] });
    expect(r.externalId).toMatch(/^ig_/);
  });

  it("every rule-breaker submission is logged as a publish attempt", async () => {
    const log = await listPublishAttempts();
    const rb = log.filter((a) => a.source === "rule_breaker");
    expect(rb.length).toBeGreaterThanOrEqual(5);
    expect(rb.some((a) => !a.ok && a.reasons?.some((r) => r.code === "FILE_TOO_LARGE"))).toBe(true);
  });
});
