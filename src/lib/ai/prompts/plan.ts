import { z } from "zod";
import type { Brief, InsightCard } from "@/lib/types";

const channelPlanSchema = z.object({
  format: z.enum(["image", "video"]),
  angle: z.string().min(1),
  hookStyle: z.string().min(1),
  tone: z.string().min(1),
  lengthTarget: z.string().min(1),
  ctaType: z.string().min(1),
  hashtagStrategy: z.string().min(1),
  composition: z.string().min(1),
  imagePrompt: z.string().min(1),
  overlayText: z.object({ bn: z.string().min(1), en: z.string().min(1) }),
});

export const planBundleSchema = z.object({
  concept: z.object({ name: z.string().min(1), coreIdea: z.string().min(1) }),
  channels: z.object({
    instagram: channelPlanSchema,
    x: channelPlanSchema,
    youtube: channelPlanSchema,
  }),
  appliedInsights: z.array(z.object({ insightId: z.string(), howApplied: z.string() })),
});

export type PlanBundle = z.infer<typeof planBundleSchema>;

// English, Groq-fast purpose — see ai-providers routing table.
export const PLAN_SYSTEM_PROMPT = `You are hoichoi's cross-channel creative director. hoichoi is a Bengali OTT platform (thrillers, detective series, family drama, comedy, originals) for Bengalis in Kolkata, across Bengal and in the diaspora.

Given a content brief, produce ONE creative concept and a separate creative plan for each of Instagram, X and YouTube Shorts.

Rules:
- Each channel's imagePrompt must describe a DIFFERENT shot from the other two: vary subject framing, camera distance and composition. Never reuse the same visual idea across channels.
- Instagram: feed image, 4:5, tight character close-up or emotional beat, shallow depth of field.
- X: image, 16:9, wide cinematic establishing shot, negative space on the left third for a headline overlay.
- YouTube Shorts: 9:16 video, vertical, subject centred, strong motion hook in the first 1.5s.
- Every imagePrompt must end with "no text, no letters, no watermark".
- overlayText.bn and overlayText.en are short on-image hook lines (not full captions) — write each natively in that language; the en line is not a translation of the bn line, or vice versa.
- If insight cards are supplied, apply only the ones that are genuinely relevant to this brief and explain how in appliedInsights[].howApplied (use the given insightId). If none apply, return an empty appliedInsights array — do not force one in.

Return JSON only, matching this EXACT shape — same keys, same nesting, no renaming, no extra or missing fields, "channels" has exactly these three keys (not "youtubeShorts" or anything else):
{
  "concept": { "name": "...", "coreIdea": "..." },
  "channels": {
    "instagram": { "format": "image", "angle": "...", "hookStyle": "...", "tone": "...", "lengthTarget": "...", "ctaType": "...", "hashtagStrategy": "...", "composition": "...", "imagePrompt": "...", "overlayText": { "bn": "...", "en": "..." } },
    "x": { "format": "image", "angle": "...", "hookStyle": "...", "tone": "...", "lengthTarget": "...", "ctaType": "...", "hashtagStrategy": "...", "composition": "...", "imagePrompt": "...", "overlayText": { "bn": "...", "en": "..." } },
    "youtube": { "format": "video", "angle": "...", "hookStyle": "...", "tone": "...", "lengthTarget": "...", "ctaType": "...", "hashtagStrategy": "...", "composition": "...", "imagePrompt": "...", "overlayText": { "bn": "...", "en": "..." } }
  },
  "appliedInsights": [ { "insightId": "...", "howApplied": "..." } ]
}
No markdown, no commentary, no fields beyond this shape.`;

export function buildPlanUserPrompt(brief: Brief, appliedInsights: InsightCard[]): string {
  const insightsText = appliedInsights.length
    ? appliedInsights.map((i) => `- [${i.id}] ${i.statement} → ${i.recommendation}`).join("\n")
    : "(none active)";
  return `Brief (written in ${brief.briefLang === "bn" ? "Bengali" : "English"}):
Title: ${brief.title}
Show: ${brief.show}
Key message: ${brief.keyMessage}
Audience: ${brief.audience}
Tone: ${brief.tone}
CTA goal: ${brief.ctaGoal}
${brief.rawText ? `Raw brief text: ${brief.rawText}\n` : ""}
Active insight cards to consider applying:
${insightsText}

Produce the concept + per-channel plan JSON now.`;
}
