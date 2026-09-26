"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { concepts, variants as variantsTable } from "@/db/schema";
import { transition, type VariantAction } from "@/lib/domain/status";
import { computeContentHash } from "@/lib/domain/approval";
import type { Approval, Channel, Lang, Variant, VariantStatus } from "@/lib/types";

// listVariants/getVariant are DB-backed (M1). approve/edit/discard/regenerate
// stay M0 mock stubs — already run through the real domain gate so the UI
// team can build against true state-machine behavior — pending M3 wiring.

function rowToVariant(row: typeof variantsTable.$inferSelect): Variant {
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

function mockVariant(overrides: Partial<Variant> = {}): Variant {
  const caption = overrides.caption ?? "আজ রাতে নতুন পর্ব — মিস করবেন না!";
  return {
    id: overrides.id ?? `P-${randomUUID().slice(0, 4)}`,
    conceptId: overrides.conceptId ?? "concept-mock",
    channel: overrides.channel ?? "instagram",
    lang: overrides.lang ?? "bn",
    format: overrides.format ?? "image",
    caption,
    hashtags: overrides.hashtags ?? ["#hoichoi", "#বাংলা"],
    cta: overrides.cta ?? "এখনই দেখুন",
    hook: overrides.hook ?? "এই মোড় আপনাকে চমকে দেবে",
    planJson: overrides.planJson ?? null,
    imagePrompt:
      overrides.imagePrompt ??
      "cinematic still from a bengali drama series, dramatic lighting, 4:5 portrait",
    assetUrl: overrides.assetUrl ?? null,
    assetSha256: overrides.assetSha256 ?? null,
    width: overrides.width ?? null,
    height: overrides.height ?? null,
    bytes: overrides.bytes ?? null,
    durationSec: overrides.durationSec ?? null,
    criticJson: overrides.criticJson ?? null,
    status: overrides.status ?? "draft",
    version: overrides.version ?? 1,
    parentId: overrides.parentId ?? null,
    discardNote: overrides.discardNote ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

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
  return rows.map(rowToVariant);
}

export async function getVariant(variantId: string): Promise<Variant | null> {
  const rows = await db.select().from(variantsTable).where(eq(variantsTable.id, variantId)).limit(1);
  return rows[0] ? rowToVariant(rows[0]) : null;
}

export async function approveVariant(variantId: string, approver: string): Promise<Approval> {
  const variant = mockVariant({ id: variantId, status: "draft" });
  transition(variant.status, "approve"); // throws IllegalTransitionError if not draft
  const contentHash = computeContentHash({
    caption: variant.caption,
    hashtags: variant.hashtags,
    cta: variant.cta,
    hook: variant.hook,
    assetUrl: variant.assetUrl,
    assetSha256: variant.assetSha256,
  });
  return {
    id: randomUUID(),
    variantId,
    approver,
    contentHash,
    approvedAt: new Date(),
    revokedAt: null,
  };
}

export interface EditVariantPatch {
  caption?: string;
  hashtags?: string[];
  cta?: string;
  hook?: string;
  imagePrompt?: string;
}

// Editing always clears any existing approval (non-negotiable #3): the
// returned variant is forced back to "draft" via the same transition table
// the scheduler enforces.
export async function editVariant(variantId: string, patch: EditVariantPatch): Promise<Variant> {
  const current = mockVariant({ id: variantId, status: "approved" });
  const editAction: VariantAction = "edit";
  const nextStatus = current.status === "draft" ? current.status : transition(current.status, editAction);
  return mockVariant({ ...current, ...patch, status: nextStatus });
}

export async function discardVariant(variantId: string, note: string): Promise<Variant> {
  const current = mockVariant({ id: variantId, status: "draft" });
  const nextStatus = transition(current.status, "discard");
  return mockVariant({ ...current, status: nextStatus, discardNote: note });
}

// Regeneration never mutates the discarded row — it creates a new draft
// variant with version+1 and parentId set, per docs/ARCHITECTURE.md.
export async function regenerateVariant(variantId: string, note?: string): Promise<Variant> {
  const discarded = mockVariant({ id: variantId, status: "discarded", discardNote: note ?? null });
  const nextStatus = transition(discarded.status, "regenerate");
  return mockVariant({
    id: `P-${randomUUID().slice(0, 4)}`,
    status: nextStatus,
    version: discarded.version + 1,
    parentId: discarded.id,
    discardNote: null,
  });
}
