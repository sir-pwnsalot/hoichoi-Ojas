import { describe, expect, it } from "vitest";
import { buildWeekFacts, type FactInput } from "@/lib/report/facts";
import { generateGroundedReport, type ReportDraft } from "@/lib/report/generate";
import type { Channel, Lang } from "@/lib/types";

const input = (id: string, channel: Channel, lang: Lang, er: number, hourUTC: number): FactInput => ({
  row: { conceptId: "c1", conceptName: "Launch", channel, lang, variantId: id, ageHours: 72, engagementRate: er, shareRate: 0.01, saveRate: 0.005, completionProxy: null, impressions: 1000 },
  publishedAt: new Date(Date.UTC(2026, 8, 2, hourUTC)),
  format: "image",
  ctaType: lang === "bn" ? "question" : "watch",
  hook: "h",
});
const FACTS = buildWeekFacts(
  [input("P-1", "instagram", "bn", 0.052, 14), input("P-2", "instagram", "en", 0.04, 4)],
  new Date(Date.UTC(2026, 8, 1)),
  ["P-99"],
);

describe("facts", () => {
  it("computes display-unit aggregates in code", () => {
    const get = (k: string) => FACTS.aggregates.find((a) => a.key === k)?.value;
    expect(FACTS.posts[0].engagementRate).toBe(5.2);
    expect(FACTS.posts[0].hourIST).toBe(19);
    expect(get("bnLift.instagram")).toBe(30);
    expect(get("er.cta.question")).toBe(5.2);
    expect(get("er.time.evening")).toBe(5.2);
    expect(get("top.engagementRate")).toBe(5.2);
  });
});

const good = { text: "bn IG at 5.2% [P-1]", postIds: ["P-1"], figures: [{ postId: "P-1", metric: "engagementRate", value: 5.2 }] };
const bad = { text: "bn IG at 9% [P-1]", postIds: ["P-1"], figures: [{ postId: "P-1", metric: "engagementRate", value: 9 }] };
const ins = { statement: "bn wins", lever: "lang" as const, recommendation: "lead bn", evidencePostIds: ["P-1", "P-2"] };

describe("generateGroundedReport", () => {
  it("regenerates once with the errors, then passes as verified", async () => {
    const feedback: (string[] | undefined)[] = [];
    const drafts: ReportDraft[] = [
      { summary: [bad], sections: [], insights: [ins] },
      { summary: [good], sections: [], insights: [ins] },
    ];
    const r = await generateGroundedReport(FACTS, async (_f, fb) => (feedback.push(fb), drafts.shift()!));
    expect(feedback[0]).toBeUndefined();
    expect(feedback[1]?.join(" ")).toMatch(/9 in the claim but 5\.2/);
    expect(r).toMatchObject({ verified: true, attempts: 2, unverifiedReasons: [] });
    expect(r.draft.summary).toEqual([good]);
  });

  it("drops what still fails after one retry and marks the report unverified", async () => {
    let calls = 0;
    const r = await generateGroundedReport(FACTS, async () => {
      calls++;
      return { summary: [good, bad], sections: [{ title: "T", claims: [{ ...good, postIds: [], text: "uncited" }] }], insights: [ins, { ...ins, evidencePostIds: ["P-99"] }] };
    });
    expect(calls).toBe(2);
    expect(r.verified).toBe(false);
    expect(r.draft.summary).toEqual([good]);
    expect(r.draft.sections).toEqual([]);
    expect(r.draft.insights).toEqual([ins]);
    expect(r.unverifiedReasons).toHaveLength(3);
  });
});
