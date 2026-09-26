"use server";

import { randomUUID } from "node:crypto";
import type { Brief, BriefInput, Concept } from "@/lib/types";

// M0 stub: returns realistic mock data with the final shape. Wired to
// src/db in M1 (brief persistence) and M1/M2 (campaign generation pipeline).

export async function createBrief(input: BriefInput): Promise<Brief> {
  return {
    id: randomUUID(),
    title: input.title,
    show: input.show,
    keyMessage: input.keyMessage,
    audience: input.audience,
    languages: input.languages,
    tone: input.tone,
    ctaGoal: input.ctaGoal,
    rawText: input.rawText ?? null,
    briefLang: input.briefLang,
    appliedInsightIds: input.appliedInsightIds ?? [],
    createdAt: new Date(),
  };
}

export interface GenerateCampaignResult {
  conceptIds: string[];
  variantIds: string[];
}

// Kicks off the full pipeline: creative plan per channel -> copy per
// (channel x language) -> critic -> images -> persisted draft variants.
export async function generateCampaign(briefId: string): Promise<GenerateCampaignResult> {
  const conceptId = randomUUID();
  const variantIds = [
    "instagram" as const,
    "x" as const,
    "youtube" as const,
  ].flatMap((channel) => [`${channel}-bn-${briefId.slice(0, 4)}`, `${channel}-en-${briefId.slice(0, 4)}`]);

  return {
    conceptIds: [conceptId],
    variantIds,
  };
}

export async function listConcepts(briefId: string): Promise<Concept[]> {
  return [
    {
      id: randomUUID(),
      briefId,
      name: "Episode 5 launch",
      createdAt: new Date(),
    },
  ];
}
