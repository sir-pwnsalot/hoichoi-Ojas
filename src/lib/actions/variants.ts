"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { approvals, briefs, concepts, variants as variantsTable } from "@/db/schema";
import { transition } from "@/lib/domain/status";
import { now } from "@/lib/domain/clock";
import { generateCopy } from "@/lib/ai/copy";
import { buildCriticResult, generateBnCopyWithCritic } from "@/lib/ai/critic";
import { generateChannelBaseImages } from "@/lib/ai/base-images";
import { recomputeConceptTailoring } from "@/lib/assets";
import {
  activeApproval,
  contentHashOf,
  loadVariantRow,
  nextPostId,
  revokeApprovals,
  rowToBrief,
  rowToVariant,
} from "@/lib/repo";
import type { Approval, Channel, CreativePlan, Lang, TailoringReport, Variant, VariantStatus } from "@/lib/types";

// Review-gate actions (M3), DB-backed. Every status change goes through the
// state machine in src/lib/domain/status.ts; every content change revokes
// any approval (non-negotiable #3).

export interface ListVariantsFilter {
  briefId?: string;
  conceptId?: string;
  channel?: Channel;
  lang?: Lang;
  status?: VariantStatus;
}

export async function listVariants(filter: ListVariantsFilter = {}): Promise<Variant[]> {
  const conditions = [];
  if (filter.conceptId) conditions.push(eq(variantsTable.conceptId, filter.conceptId));
  if (filter.channel) conditions.push(eq(variantsTable.channel, filter.channel));
  if (filter.lang) conditions.push(eq(variantsTable.lang, filter.lang));
  if (filter.status) conditions.push(eq(variantsTable.status, filter.status));
  if (filter.briefId) {
    const conceptRows = await db
      .select({ id: concepts.id })
      .from(concepts)
      .where(eq(concepts.briefId, filter.briefId));
    const conceptIds = conceptRows.map((r) => r.id);
    if (conceptIds.length === 0) return [];
    conditions.push(inArray(variantsTable.conceptId, conceptIds));
  }

  const rows = conditions.length
    ? await db
        .select()
        .from(variantsTable)
        .where(and(...conditions))
    : await db.select().from(variantsTable);
  return withTailoring(rows);
}

// Attaches each concept's stored dHash similarity report (non-negotiable #1).
async function withTailoring(rows: (typeof variantsTable.$inferSelect)[]): Promise<Variant[]> {
  const conceptIds = [...new Set(rows.map((r) => r.conceptId))];
  if (conceptIds.length === 0) return [];
  const conceptRows = await db
    .select({ id: concepts.id, similarityJson: concepts.similarityJson })
    .from(concepts)
    .where(inArray(concepts.id, conceptIds));
  const byConcept = new Map(
    conceptRows.map((c) => [c.id, (c.similarityJson as unknown as TailoringReport | null) ?? null]),
  );
  return rows.map((r) => rowToVariant(r, byConcept.get(r.conceptId) ?? null));
}

export async function getVariant(variantId: string): Promise<Variant | null> {
  const rows = await db.select().from(variantsTable).where(eq(variantsTable.id, variantId)).limit(1);
  if (!rows[0]) return null;
  return (await withTailoring(rows))[0];
}

// Latest active approval for a variant (review screen badge), or null.
export async function getApproval(variantId: string): Promise<Approval | null> {
  return activeApproval(variantId);
}

// Records approver, time and the hash of the exact content being approved.
export async function approveVariant(variantId: string, approver: string): Promise<Approval> {
  const row = await loadVariantRow(variantId);
  const next = transition(row.status as VariantStatus, "approve"); // only drafts
  const at = await now();
  await revokeApprovals(variantId, at); // at most one active approval
  const approval: Approval = {
    id: randomUUID(),
    variantId,
    approver,
    contentHash: contentHashOf(rowToVariant(row)),
    approvedAt: at,
    revokedAt: null,
  };
  await db.insert(approvals).values(approval);
  await db.update(variantsTable).set({ status: next }).where(eq(variantsTable.id, variantId));
  return approval;
}

export interface EditVariantPatch {
  caption?: string;
  hashtags?: string[];
  cta?: string;
  hook?: string;
  imagePrompt?: string;
}

// Any edit clears the approval: approved/rejected go back to draft and the
// approval is revoked. Scheduled/published/discarded can't be edited.
export async function editVariant(variantId: string, patch: EditVariantPatch): Promise<Variant> {
  const row = await loadVariantRow(variantId);
  const status = row.status as VariantStatus;
  const next = status === "draft" ? "draft" : transition(status, "edit");
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  await db
    .update(variantsTable)
    .set({ ...clean, status: next })
    .where(eq(variantsTable.id, variantId));
  await revokeApprovals(variantId, await now());
  return (await getVariant(variantId))!;
}

export async function discardVariant(variantId: string, note: string): Promise<Variant> {
  const row = await loadVariantRow(variantId);
  const next = transition(row.status as VariantStatus, "discard");
  await db
    .update(variantsTable)
    .set({ status: next, discardNote: note })
    .where(eq(variantsTable.id, variantId));
  await revokeApprovals(variantId, await now());
  await recomputeConceptTailoring(row.conceptId);
  return (await getVariant(variantId))!;
}

// Never mutates the discarded row: creates a new draft (version+1, parentId)
// by re-running this channel × language through the copy pipeline (bn via the
// Bengali prompt + critic, never a translation) and the image pipeline, with
// the reviewer's discard note folded in.
export async function regenerateVariant(variantId: string, note?: string): Promise<Variant> {
  const parent = await loadVariantRow(variantId);
  const status = transition(parent.status as VariantStatus, "regenerate");
  const reviewerNote = note?.trim() || parent.discardNote || undefined;
  const notes = reviewerNote ? `Reviewer rejected the previous version: ${reviewerNote}` : undefined;

  const [conceptRow] = await db.select().from(concepts).where(eq(concepts.id, parent.conceptId)).limit(1);
  const [briefRow] = await db.select().from(briefs).where(eq(briefs.id, conceptRow.briefId)).limit(1);
  const brief = rowToBrief(briefRow);
  const channel = parent.channel as Channel;
  const lang = parent.lang as Lang;
  const plan: CreativePlan = (parent.planJson as unknown as CreativePlan | null) ?? {
    channel,
    angle: parent.hook,
    hook: parent.hook,
    tone: brief.tone,
    length: "",
    ctaType: parent.cta,
    hashtagStrategy: "",
    visualComposition: "",
    imagePrompt: parent.imagePrompt,
    appliedInsights: [],
  };

  let copy;
  let criticJson: Record<string, unknown> | null = null;
  if (lang === "bn") {
    const res = await generateBnCopyWithCritic({ channel, brief, plan, notes });
    copy = res.copy;
    // Independence judge against the current en sibling for this channel.
    const [enSibling] = await db
      .select({ caption: variantsTable.caption })
      .from(variantsTable)
      .where(
        and(
          eq(variantsTable.conceptId, parent.conceptId),
          eq(variantsTable.channel, channel),
          eq(variantsTable.lang, "en"),
          ne(variantsTable.status, "discarded"),
        ),
      )
      .orderBy(desc(variantsTable.version))
      .limit(1);
    const critic = enSibling
      ? await buildCriticResult(res.critic, copy.caption, enSibling.caption)
      : {
          score: res.critic.score,
          isTranslation: false,
          flaggedPhrases: res.critic.flags.map((f) => `${f.phrase} — ${f.why}`),
          notes: res.critic.verdict,
        };
    criticJson = critic as unknown as Record<string, unknown>;
  } else {
    copy = await generateCopy({ lang, channel, brief, plan, notes });
  }

  // New base image(s) with a new seed; keep the parent's if generation fails.
  let image = {
    urls: parent.baseImageUrls ?? [],
    provider: parent.imageProvider,
    seed: parent.imageSeed,
    dhash: parent.dhash,
    prompt: parent.imagePrompt,
  };
  try {
    const prompt = reviewerNote ? `${plan.imagePrompt}, art direction: ${reviewerNote}` : plan.imagePrompt;
    image = await generateChannelBaseImages(channel, prompt, (parent.imageSeed ?? 0) + 7919 * parent.version);
  } catch (err) {
    console.error(`[regenerate] ${variantId} image failed, keeping parent's:`, err instanceof Error ? err.message : err);
  }

  const id = await nextPostId();
  await db.insert(variantsTable).values({
    id,
    conceptId: parent.conceptId,
    channel,
    lang,
    format: parent.format,
    caption: copy.caption,
    hashtags: copy.hashtags,
    cta: copy.cta,
    hook: copy.hook,
    planJson: parent.planJson,
    imagePrompt: image.prompt,
    baseImageUrls: image.urls,
    imageProvider: image.provider,
    imageSeed: image.seed,
    dhash: image.dhash,
    assetUrl: null,
    assetSha256: null,
    width: null,
    height: null,
    bytes: null,
    durationSec: null,
    criticJson,
    status,
    version: parent.version + 1,
    parentId: parent.id,
    discardNote: null,
    createdAt: await now(),
  });
  await recomputeConceptTailoring(parent.conceptId);
  return (await getVariant(id))!;
}
