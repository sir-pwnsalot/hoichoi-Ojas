import { describe, expect, it } from "vitest";
import { buildPlanUserPrompt, planBundleSchema } from "@/lib/ai/prompts/plan";
import type { Brief, InsightCard } from "@/lib/types";

const brief: Brief = {
  id: "b1", title: "T", show: "Byomkesh", keyMessage: "k", audience: "a", languages: ["bn", "en"], tone: "t",
  ctaGoal: "watch", rawText: null, briefLang: "en", appliedInsightIds: ["seed-ins-cta"], createdAt: new Date(),
};
const card: InsightCard = {
  id: "seed-ins-cta", reportId: "r", statement: "Question CTAs out-engage watch CTAs", evidencePostIds: ["P-9025"],
  lever: "cta", recommendation: "End with a Bengali question CTA", active: true,
};

describe("insights → plan prompt", () => {
  it("injects each selected card with its id, lever and recommendation", () => {
    const p = buildPlanUserPrompt(brief, [card]);
    expect(p).toContain("insightId=seed-ins-cta");
    expect(p).toContain("lever=cta");
    expect(p).toContain("End with a Bengali question CTA");
  });

  it("the plan schema requires appliedInsights[{insightId, howApplied}]", () => {
    const shape = planBundleSchema.shape.appliedInsights;
    expect(shape.safeParse([{ insightId: "seed-ins-cta", howApplied: "Shorts bn opens with a question" }]).success).toBe(true);
    expect(shape.safeParse([{ insightId: "seed-ins-cta" }]).success).toBe(false);
  });
});
