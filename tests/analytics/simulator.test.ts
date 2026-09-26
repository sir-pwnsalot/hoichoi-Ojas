import { describe, expect, it } from "vitest";
import { accrued, CAPTURE_POINTS_H, mulberry32, simulate, type PostFeatures } from "@/lib/analytics/simulator";
import { toMetrics } from "@/lib/analytics/ingest";
import { rates } from "@/lib/analytics/compare";

const f = (o: Partial<PostFeatures> = {}): PostFeatures => ({
  channel: "instagram",
  lang: "en",
  format: "image",
  ctaType: "watch",
  hourIst: 14,
  hashtagCount: 3,
  ...o,
});

const N = 300;
const sum = (feat: PostFeatures, pick: (i: number) => number) => {
  let s = 0;
  for (let i = 0; i < N; i++) s += pick(i);
  return s;
};
const final = (feat: PostFeatures, i: number) => toMetrics(simulate(`P-${i}`, feat, 168));
const meanEng = (feat: PostFeatures) =>
  sum(feat, (i) => rates(final(feat, i), feat.durationSec ?? null).engagementRate) / N;

describe("simulator", () => {
  it("is deterministic: same variantId + features → identical payloads", () => {
    for (const h of CAPTURE_POINTS_H) {
      expect(simulate("P-0042", f(), h)).toEqual(simulate("P-0042", f(), h));
    }
    expect(simulate("P-0042", f(), 72)).not.toEqual(simulate("P-0043", f(), 72));
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("emits platform-native field names", () => {
    expect(Object.keys(simulate("P-1", f(), 24))).toEqual(
      expect.arrayContaining(["impressions", "reach", "likes", "comments", "saves", "shares"]),
    );
    expect(simulate("P-1", f({ channel: "x" }), 24)).toHaveProperty("retweet_count");
    expect(simulate("P-1", f({ channel: "youtube", format: "video", durationSec: 20 }), 24)).toHaveProperty(
      "averageViewDuration",
    );
  });

  it("accrues monotonically along the decay curve (≈60% by 24h, 90% by 72h)", () => {
    expect(accrued(24)).toBeCloseTo(0.6);
    expect(accrued(72)).toBeCloseTo(0.9);
    let prev = -1;
    for (const h of CAPTURE_POINTS_H) {
      const imp = toMetrics(simulate("P-7", f(), h)).impressions;
      expect(imp).toBeGreaterThanOrEqual(prev);
      prev = imp;
    }
  });

  it("planted patterns show up in normalised rates", () => {
    const ratio = (a: PostFeatures, b: PostFeatures) => meanEng(a) / meanEng(b);
    const yt = { channel: "youtube", format: "video", durationSec: 20 } as const;
    expect(ratio(f({ lang: "bn" }), f())).toBeGreaterThan(1.2); // bn > en on IG
    expect(ratio(f({ ...yt, lang: "bn" }), f(yt))).toBeGreaterThan(1.2); // and on Shorts
    expect(Math.abs(ratio(f({ channel: "x", lang: "bn" }), f({ channel: "x" })) - 1)).toBeLessThan(0.06); // ≈ on X
    expect(ratio(f({ hourIst: 20 }), f())).toBeGreaterThan(1.12); // prime time
    expect(ratio(f({ channel: "x", hashtagCount: 5 }), f({ channel: "x", hashtagCount: 2 }))).toBeLessThan(0.9);

    const comments = (feat: PostFeatures) => sum(feat, (i) => final(feat, i).comments);
    expect(comments(f({ ctaType: "question" })) / comments(f())).toBeGreaterThan(1.15);

    const share = (feat: PostFeatures) => sum(feat, (i) => rates(final(feat, i), 20).shareRate);
    expect(share(f(yt))).toBeGreaterThan(share(f()));
    expect(share(f(yt))).toBeGreaterThan(share(f({ channel: "x" })));
  });
});
