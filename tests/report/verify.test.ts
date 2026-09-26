import { describe, expect, it } from "vitest";
import { verifyClaim, verifyDraft } from "@/lib/report/verify";
import type { WeekFacts } from "@/lib/report/facts";
import type { DraftClaim, ReportDraft } from "@/lib/report/generate";

const post = (id: string, lang: "bn" | "en", engagementRate: number) => ({
  id,
  conceptId: "c1",
  conceptName: "Launch",
  channel: "instagram" as const,
  lang,
  format: "image" as const,
  ctaType: "question",
  hook: "hook",
  publishedAt: "2026-09-02T14:30:00.000Z",
  hourIST: 20,
  ageHours: 72,
  engagementRate,
  shareRate: 0.4,
  saveRate: 0.3,
  completionProxy: null,
  impressions: 12000,
});

const FACTS: WeekFacts = {
  weekStart: "2026-09-01T00:00:00.000Z",
  weekEnd: "2026-09-08T00:00:00.000Z",
  posts: [post("P-0001", "bn", 5.2), post("P-0002", "en", 3.8)],
  aggregates: [
    { key: "bnLift.instagram", label: "IG bn vs en engagement lift (%)", value: 36.8, postIds: ["P-0001", "P-0002"] },
  ],
  otherPostIds: ["P-0100"],
};

const good: DraftClaim = {
  text: "Bengali beat English on Instagram: 5.2% vs 3.8% engagement [P-0001] [P-0002], a 36.8% lift.",
  postIds: ["P-0001", "P-0002"],
  figures: [
    { postId: "P-0001", metric: "engagementRate", value: 5.2 },
    { postId: "P-0002", metric: "engagementRate", value: 3.8 },
    { metric: "bnLift.instagram", value: 36.8 },
  ],
};

describe("verifyClaim", () => {
  it("accepts a grounded claim (and display rounding)", () => {
    expect(verifyClaim(good, FACTS)).toEqual([]);
    expect(
      verifyClaim({ text: "IG bn lift was 37% [P-0001]", postIds: ["P-0001"], figures: [{ metric: "bnLift.instagram", value: 37 }] }, FACTS),
    ).toEqual([]);
  });

  it("rejects a claim without a citation", () => {
    const errs = verifyClaim({ ...good, text: "Bengali won on Instagram.", postIds: [], figures: [] }, FACTS);
    expect(errs.join(" ")).toMatch(/no post ID/i);
  });

  it("rejects an inline [P-…] missing from postIds", () => {
    const errs = verifyClaim({ ...good, postIds: ["P-0001"], figures: [good.figures[0]] }, FACTS);
    expect(errs.join(" ")).toMatch(/P-0002.*not in postIds/);
  });

  it("rejects an unknown post ID", () => {
    const errs = verifyClaim({ text: "Great post [P-4242]", postIds: ["P-4242"], figures: [] }, FACTS);
    expect(errs.join(" ")).toMatch(/P-4242.*does not exist/);
  });

  it("rejects a post outside the report week", () => {
    const errs = verifyClaim({ text: "Old post [P-0100]", postIds: ["P-0100"], figures: [] }, FACTS);
    expect(errs.join(" ")).toMatch(/P-0100.*outside the report week/);
  });

  it("rejects a wrong number", () => {
    const errs = verifyClaim(
      { ...good, figures: [{ postId: "P-0001", metric: "engagementRate", value: 6.1 }] },
      FACTS,
    );
    expect(errs.join(" ")).toMatch(/engagementRate.*6\.1.*5\.2/);
  });

  it("rejects a % in the text that no figure backs", () => {
    const errs = verifyClaim(
      { text: "IG bn engagement hit 9.9% [P-0001]", postIds: ["P-0001"], figures: [{ postId: "P-0001", metric: "engagementRate", value: 5.2 }] },
      FACTS,
    );
    expect(errs.join(" ")).toMatch(/9\.9%/);
  });

  it("rejects an unknown metric", () => {
    const errs = verifyClaim({ ...good, figures: [{ metric: "vibes", value: 1 }] }, FACTS);
    expect(errs.join(" ")).toMatch(/unknown metric "vibes"/);
  });
});

describe("verifyDraft", () => {
  it("collects errors per claim and insight", () => {
    const draft: ReportDraft = {
      summary: [good],
      sections: [{ title: "Lang", claims: [{ text: "No cite", postIds: [], figures: [] }] }],
      insights: [
        { statement: "bn wins IG", lever: "lang", recommendation: "Lead IG with bn", evidencePostIds: ["P-0001"] },
        { statement: "old", lever: "time", recommendation: "x", evidencePostIds: ["P-0100"] },
      ],
    };
    const r = verifyDraft(draft, FACTS);
    expect(r.ok).toBe(false);
    expect(r.claims.map((c) => c.errors.length > 0)).toEqual([false, true]);
    expect(r.insights.map((i) => i.errors.length > 0)).toEqual([false, true]);
    expect(r.errors.length).toBe(2);
  });
});
