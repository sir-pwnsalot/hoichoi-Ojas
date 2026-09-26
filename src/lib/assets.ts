import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { approvals, concepts, variants } from "@/db/schema";
import { transition } from "@/lib/domain/status";
import { buildTailoringReport, dHash } from "@/lib/ai/tailoring";
import { probeAsset, type AssetProbe } from "@/lib/media/probe";
import { putObject } from "@/lib/storage";
import type { Channel, TailoringReport, VariantStatus } from "@/lib/types";

// Server-side handling of composed assets uploaded from the browser
// composers (POST /api/assets). Every stored fact comes from the bytes.

export class AssetConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetConflictError";
  }
}

export class VariantNotFoundError extends Error {
  constructor(variantId: string) {
    super(`Variant "${variantId}" not found`);
    this.name = "VariantNotFoundError";
  }
}

export interface AttachedAsset extends AssetProbe {
  variantId: string;
  url: string;
  status: VariantStatus;
  approvalCleared: boolean;
  tailoring: TailoringReport | null;
}

const EXT: Record<AssetProbe["format"], string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  mp4: "mp4",
  webm: "webm",
};

export async function attachComposedAsset(variantId: string, bytes: Uint8Array): Promise<AttachedAsset> {
  const rows = await db.select().from(variants).where(eq(variants.id, variantId)).limit(1);
  const variant = rows[0];
  if (!variant) throw new VariantNotFoundError(variantId);

  // Replacing the asset is an edit (non-negotiable #3): approved/rejected go
  // back to draft and any approval is revoked; scheduled/published/discarded
  // variants can't have their asset swapped.
  const status = variant.status as VariantStatus;
  let nextStatus: VariantStatus = status;
  if (status !== "draft") {
    if (status !== "approved" && status !== "rejected") {
      throw new AssetConflictError(`Cannot replace the asset of a "${status}" variant`);
    }
    nextStatus = transition(status, "edit");
  }

  const probe = await probeAsset(bytes);
  const url = await putObject(`assets/${variantId}-${probe.sha256.slice(0, 12)}.${EXT[probe.format]}`, bytes, probe.mime);
  const imageHash = probe.format === "mp4" || probe.format === "webm" ? null : await dHash(bytes);

  await db
    .update(variants)
    .set({
      assetUrl: url,
      assetSha256: probe.sha256,
      width: probe.width,
      height: probe.height,
      bytes: probe.bytes,
      durationSec: probe.durationSec,
      status: nextStatus,
      // Videos keep the base-frame hash (the composed video's first frame is that frame).
      ...(imageHash ? { dhash: imageHash } : {}),
    })
    .where(eq(variants.id, variantId));

  const revoked = await db
    .update(approvals)
    .set({ revokedAt: new Date() })
    .where(and(eq(approvals.variantId, variantId), isNull(approvals.revokedAt)))
    .returning({ id: approvals.id });

  const tailoring = await recomputeConceptTailoring(variant.conceptId);

  return {
    ...probe,
    variantId,
    url,
    status: nextStatus,
    approvalCleared: revoked.length > 0 || nextStatus !== status,
    tailoring,
  };
}

// Recomputes the concept's cross-channel similarity from each variant's
// stored dHash and persists it on the concept.
export async function recomputeConceptTailoring(conceptId: string): Promise<TailoringReport | null> {
  const rows = await db
    .select({ channel: variants.channel, dhash: variants.dhash, status: variants.status })
    .from(variants)
    .where(eq(variants.conceptId, conceptId));
  const hashes: Partial<Record<Channel, string[]>> = {};
  for (const r of rows) {
    if (!r.dhash || r.status === "discarded") continue;
    (hashes[r.channel as Channel] ??= []).push(r.dhash);
  }
  if (Object.keys(hashes).length < 2) return null;
  const report = buildTailoringReport(hashes);
  await db
    .update(concepts)
    .set({ similarityJson: report as unknown as Record<string, unknown> })
    .where(eq(concepts.id, conceptId));
  return report;
}
