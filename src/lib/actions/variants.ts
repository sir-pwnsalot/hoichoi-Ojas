"use server";

import { randomUUID } from "node:crypto";
import { transition, type VariantAction } from "@/lib/domain/status";
import { computeContentHash } from "@/lib/domain/approval";
import type { Approval, Channel, Lang, Variant, VariantStatus } from "@/lib/types";

// M0 stub: returns realistic mock data with the final shape, and already
// runs edits/approvals through the real domain gate (src/lib/domain) so the
// UI team can build against true state-machine behavior. Wired to src/db in M1.

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
  const channels: Channel[] = filter.channel ? [filter.channel] : ["instagram", "x", "youtube"];
  const langs: Lang[] = filter.lang ? [filter.lang] : ["bn", "en"];
  return channels.flatMap((channel) =>
    langs.map((lang) =>
      mockVariant({
        channel,
        lang,
        conceptId: filter.conceptId ?? "concept-mock",
        status: filter.status ?? "draft",
        format: channel === "youtube" ? "video" : "image",
      }),
    ),
  );
}

export async function getVariant(variantId: string): Promise<Variant | null> {
  return mockVariant({ id: variantId });
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
