import { generateJSON } from "@/lib/ai/llm";
import { planBundleSchema, PLAN_SYSTEM_PROMPT, buildPlanUserPrompt, type PlanBundle } from "@/lib/ai/prompts/plan";
import type { Brief, Channel, CreativePlan, InsightCard } from "@/lib/types";

export type { PlanBundle } from "@/lib/ai/prompts/plan";

// One call produces the concept + all three channel plans together, so the
// model can keep the shots genuinely different across channels (see
// channel-tailoring skill / non-negotiable #1).
export async function generatePlanBundle(brief: Brief, appliedInsights: InsightCard[]): Promise<PlanBundle> {
  return generateJSON({
    purpose: "plan",
    system: PLAN_SYSTEM_PROMPT,
    user: buildPlanUserPrompt(brief, appliedInsights),
    schema: planBundleSchema,
    temperature: 0.8,
  });
}

export function toCreativePlan(channel: Channel, bundle: PlanBundle): CreativePlan {
  const cp = bundle.channels[channel];
  return {
    channel,
    angle: cp.angle,
    hook: cp.hookStyle,
    tone: cp.tone,
    length: cp.lengthTarget,
    ctaType: cp.ctaType,
    hashtagStrategy: cp.hashtagStrategy,
    visualComposition: cp.composition,
    imagePrompt: cp.imagePrompt,
    appliedInsights: bundle.appliedInsights,
  };
}
