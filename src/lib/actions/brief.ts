"use server";

import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { briefs, concepts, insights as insightsTable, variants } from "@/db/schema";
import { generatePlanBundle, toCreativePlan } from "@/lib/ai/plan";
import { generateCopy } from "@/lib/ai/copy";
import { generateBnCopyWithCritic, buildCriticResult } from "@/lib/ai/critic";
import { generateConceptBaseImages } from "@/lib/ai/base-images";
import { recomputeConceptTailoring } from "@/lib/assets";
import { rowToBrief } from "@/lib/repo";
import type { Brief, BriefInput, Channel, Concept, InsightCard } from "@/lib/types";

const CHANNELS: Channel[] = ["instagram", "x", "youtube"];

export async function createBrief(input: BriefInput): Promise<Brief> {
  const brief: Brief = {
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
  await db.insert(briefs).values(brief);
  return brief;
}

async function getBriefOrThrow(briefId: string): Promise<Brief> {
  const rows = await db.select().from(briefs).where(eq(briefs.id, briefId)).limit(1);
  if (!rows[0]) throw new Error(`Brief "${briefId}" not found`);
  return rowToBrief(rows[0]);
}

async function getActiveAppliedInsights(insightIds: string[]): Promise<InsightCard[]> {
  if (insightIds.length === 0) return [];
  const rows = await db.select().from(insightsTable).where(inArray(insightsTable.id, insightIds));
  return rows.map((r) => ({
    id: r.id,
    reportId: r.reportId,
    statement: r.statement,
    evidencePostIds: r.evidencePostIds,
    lever: r.lever as InsightCard["lever"],
    recommendation: r.recommendation,
    active: r.active,
  }));
}

async function nextPostSeq(): Promise<number> {
  const rows = await db.select({ id: variants.id }).from(variants);
  return rows.length + 1;
}

export interface GenerateCampaignResult {
  conceptIds: string[];
  variantIds: string[];
}

// Full pipeline: creative plan (per channel) -> per-channel base images at
// native aspect + dHash tailoring check (M2) -> copy per (channel x lang)
// -> bn critic + regenerate-once -> independence check -> persisted draft
// variants. See docs/ARCHITECTURE.md's flow.
export async function generateCampaign(briefId: string): Promise<GenerateCampaignResult> {
  const brief = await getBriefOrThrow(briefId);
  const appliedInsights = await getActiveAppliedInsights(brief.appliedInsightIds);

  const bundle = await generatePlanBundle(brief, appliedInsights);

  const conceptId = randomUUID();
  await db.insert(concepts).values({
    id: conceptId,
    briefId,
    name: bundle.concept.name,
    createdAt: new Date(),
  });

  const { images } = await generateConceptBaseImages({
    instagram: bundle.channels.instagram.imagePrompt,
    x: bundle.channels.x.imagePrompt,
    youtube: bundle.channels.youtube.imagePrompt,
  });

  let seq = await nextPostSeq();
  const variantIds: string[] = [];

  for (const channel of CHANNELS) {
    const plan = toCreativePlan(channel, bundle);
    const format = bundle.channels[channel].format;
    const img = images[channel];
    const imageFields = {
      imagePrompt: img.prompt,
      baseImageUrls: img.urls,
      imageProvider: img.provider,
      imageSeed: img.seed,
      dhash: img.dhash,
    };

    const { copy: bnCopy, critic } = await generateBnCopyWithCritic({ channel, brief, plan });
    const enCopy = await generateCopy({ lang: "en", channel, brief, plan });
    const criticResult = await buildCriticResult(critic, bnCopy.caption, enCopy.caption);

    const bnId = `P-${String(seq++).padStart(4, "0")}`;
    const enId = `P-${String(seq++).padStart(4, "0")}`;
    const now = new Date();

    await db.insert(variants).values([
      {
        id: bnId,
        conceptId,
        channel,
        lang: "bn",
        format,
        caption: bnCopy.caption,
        hashtags: bnCopy.hashtags,
        cta: bnCopy.cta,
        hook: bnCopy.hook,
        planJson: plan as unknown as Record<string, unknown>,
        ...imageFields,
        assetUrl: null,
        assetSha256: null,
        width: null,
        height: null,
        bytes: null,
        durationSec: null,
        criticJson: criticResult as unknown as Record<string, unknown>,
        status: "draft",
        version: 1,
        parentId: null,
        discardNote: null,
        createdAt: now,
      },
      {
        id: enId,
        conceptId,
        channel,
        lang: "en",
        format,
        caption: enCopy.caption,
        hashtags: enCopy.hashtags,
        cta: enCopy.cta,
        hook: enCopy.hook,
        planJson: plan as unknown as Record<string, unknown>,
        ...imageFields,
        assetUrl: null,
        assetSha256: null,
        width: null,
        height: null,
        bytes: null,
        durationSec: null,
        criticJson: null,
        status: "draft",
        version: 1,
        parentId: null,
        discardNote: null,
        createdAt: now,
      },
    ]);

    variantIds.push(bnId, enId);
  }

  // Persist the concept's cross-channel dHash report (non-negotiable #1).
  await recomputeConceptTailoring(conceptId);

  // Record what the plan actually applied, not just what was offered —
  // non-negotiable #5 (insights reach the brief).
  await db
    .update(briefs)
    .set({ appliedInsightIds: bundle.appliedInsights.map((a) => a.insightId) })
    .where(eq(briefs.id, briefId));

  return { conceptIds: [conceptId], variantIds };
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
