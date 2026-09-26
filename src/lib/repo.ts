import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { approvals, briefs, variants } from "@/db/schema";
import { computeContentHash } from "@/lib/domain/approval";
import type { Approval, Brief, Channel, Lang, TailoringReport, Variant, VariantStatus } from "@/lib/types";

// Row <-> domain mapping and small queries shared by actions and the
// scheduler. Plain module (not "use server") so sync helpers can be exported.

export type VariantRow = typeof variants.$inferSelect;

export function rowToVariant(row: VariantRow, tailoring: TailoringReport | null = null): Variant {
  return {
    id: row.id,
    conceptId: row.conceptId,
    channel: row.channel as Channel,
    lang: row.lang as Lang,
    format: row.format as Variant["format"],
    caption: row.caption,
    hashtags: row.hashtags,
    cta: row.cta,
    hook: row.hook,
    planJson: (row.planJson as unknown as Variant["planJson"]) ?? null,
    imagePrompt: row.imagePrompt,
    baseImageUrls: row.baseImageUrls ?? [],
    imageProvider: row.imageProvider,
    imageSeed: row.imageSeed,
    tailoring,
    assetUrl: row.assetUrl,
    assetSha256: row.assetSha256,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    durationSec: row.durationSec,
    criticJson: (row.criticJson as unknown as Variant["criticJson"]) ?? null,
    status: row.status as VariantStatus,
    version: row.version,
    parentId: row.parentId,
    discardNote: row.discardNote,
    createdAt: row.createdAt,
  };
}

export class VariantNotFoundError extends Error {
  constructor(variantId: string) {
    super(`Variant "${variantId}" not found`);
    this.name = "VariantNotFoundError";
  }
}

export async function loadVariantRow(variantId: string): Promise<VariantRow> {
  const rows = await db.select().from(variants).where(eq(variants.id, variantId)).limit(1);
  if (!rows[0]) throw new VariantNotFoundError(variantId);
  return rows[0];
}

export function contentHashOf(v: Pick<Variant, "caption" | "hashtags" | "cta" | "hook" | "assetUrl" | "assetSha256">): string {
  return computeContentHash({
    caption: v.caption,
    hashtags: v.hashtags,
    cta: v.cta,
    hook: v.hook,
    assetUrl: v.assetUrl,
    assetSha256: v.assetSha256,
  });
}

// The latest non-revoked approval, or null.
export async function activeApproval(variantId: string): Promise<Approval | null> {
  const rows = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.variantId, variantId), isNull(approvals.revokedAt)))
    .orderBy(desc(approvals.approvedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function revokeApprovals(variantId: string, at: Date): Promise<number> {
  const res = await db
    .update(approvals)
    .set({ revokedAt: at })
    .where(and(eq(approvals.variantId, variantId), isNull(approvals.revokedAt)))
    .returning({ id: approvals.id });
  return res.length;
}

// Public post ids: P-0001, P-0002, … (rows are never deleted, so count+1 is unique;
// skip forward if a seeded id already occupies the slot).
export async function nextPostId(): Promise<string> {
  const rows = await db.select({ id: variants.id }).from(variants);
  const taken = new Set(rows.map((r) => r.id));
  let seq = rows.length + 1;
  while (taken.has(`P-${String(seq).padStart(4, "0")}`)) seq++;
  return `P-${String(seq).padStart(4, "0")}`;
}

export function rowToBrief(row: typeof briefs.$inferSelect): Brief {
  return {
    id: row.id,
    title: row.title,
    show: row.show,
    keyMessage: row.keyMessage,
    audience: row.audience,
    languages: row.languages as Brief["languages"],
    tone: row.tone,
    ctaGoal: row.ctaGoal,
    rawText: row.rawText,
    briefLang: row.briefLang as Brief["briefLang"],
    appliedInsightIds: row.appliedInsightIds,
    createdAt: row.createdAt,
  };
}
