import { describe, expect, it } from "vitest";
import { bnVsEn, commonAge, compareConcepts, rates, type PostSnapshot } from "@/lib/analytics/compare";
import type { UnifiedMetrics } from "@/lib/analytics/ingest";

const m = (o: Partial<UnifiedMetrics>): UnifiedMetrics => ({
  impressions: 0,
  reach: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  views: 0,
  watchTimeSec: 0,
  clicks: 0,
  ...o,
});
const snap = (
  variantId: string,
  channel: PostSnapshot["channel"],
  lang: PostSnapshot["lang"],
  ageHours: number,
  metrics: UnifiedMetrics,
  durationSec: number | null = null,
): PostSnapshot => ({ variantId, conceptId: "c1", conceptName: "Launch", channel, lang, durationSec, ageHours, metrics });

// Tiny fixture: IG bn/en reached 72h; YT bn only reached 24h → common age is 24h.
const FIX: PostSnapshot[] = [
  snap("P-1", "instagram", "bn", 24, m({ impressions: 1000, likes: 50, comments: 5, shares: 3, saves: 2 })),
  snap("P-1", "instagram", "bn", 72, m({ impressions: 2000, likes: 120, comments: 10, shares: 6, saves: 4 })),
  snap("P-2", "instagram", "en", 24, m({ impressions: 1000, likes: 40 })),
  snap("P-2", "instagram", "en", 72, m({ impressions: 5000, likes: 100 })),
  snap("P-3", "youtube", "bn", 24, m({ impressions: 400, views: 400, likes: 10, shares: 10, watchTimeSec: 4000 }), 20),
];

describe("compare", () => {
  it("normalised rates per ARCHITECTURE.md", () => {
    const r = rates(m({ impressions: 1000, likes: 50, comments: 5, shares: 3, saves: 2 }), null);
    expect(r.engagementRate).toBeCloseTo(0.06);
    expect(r.shareRate).toBeCloseTo(0.003);
    expect(r.saveRate).toBeCloseTo(0.002);
    expect(r.completionProxy).toBeNull();
    expect(rates(m({ views: 400, watchTimeSec: 4000 }), 20).completionProxy).toBeCloseTo(0.5);
    expect(rates(m({}), null).engagementRate).toBe(0); // no div-by-zero
  });

  it("aligns on the common age, not each post's latest snapshot", () => {
    expect(commonAge(FIX)).toBe(24);
    const rows = compareConcepts(FIX);
    expect(rows.map((r) => [r.variantId, r.ageHours])).toEqual([
      ["P-1", 24],
      ["P-2", 24],
      ["P-3", 24],
    ]);
    expect(rows[0].engagementRate).toBeCloseTo(0.06);
    expect(rows[1].engagementRate).toBeCloseTo(0.04);
    expect(rows[2].completionProxy).toBeCloseTo(0.5);
  });

  it("atHours forces a capture point and drops posts without it", () => {
    const rows = compareConcepts(FIX, 72);
    expect(rows.map((r) => r.variantId)).toEqual(["P-1", "P-2"]);
    expect(rows[0].engagementRate).toBeCloseTo(0.07);
    expect(rows[1].engagementRate).toBeCloseTo(0.02);
  });

  it("bn vs en on the same channel", () => {
    const split = bnVsEn(compareConcepts(FIX));
    const ig = split.find((s) => s.conceptId === "c1" && s.channel === "instagram")!;
    expect(ig.bnLift).toBeCloseTo(0.5); // 0.06 / 0.04 − 1
    expect(ig.bnPostIds).toEqual(["P-1"]);
    const yt = split.find((s) => s.conceptId === "c1" && s.channel === "youtube")!;
    expect(yt.en).toBeNull();
    expect(yt.bnLift).toBeNull();
    expect(split.filter((s) => s.conceptId === null).map((s) => s.channel)).toEqual(["instagram", "youtube"]);
  });
});
