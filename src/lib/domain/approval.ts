import { createHash } from "node:crypto";
import type { Approval } from "@/lib/types";

export interface ContentHashInput {
  caption: string;
  hashtags: string[];
  cta: string;
  hook: string;
  assetUrl: string | null;
  assetSha256: string | null;
}

// Deterministic hash of everything that makes a variant "the thing that was approved".
// Hashtag order doesn't change meaning, so it's sorted before hashing.
export function computeContentHash(input: ContentHashInput): string {
  const canonical = JSON.stringify({
    caption: input.caption,
    hashtags: [...input.hashtags].sort(),
    cta: input.cta,
    hook: input.hook,
    assetUrl: input.assetUrl,
    assetSha256: input.assetSha256,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export class NotApprovedError extends Error {
  constructor(variantId: string) {
    super(`Variant "${variantId}" has no active approval`);
    this.name = "NotApprovedError";
  }
}

export class ApprovalMismatchError extends Error {
  constructor(variantId: string) {
    super(
      `Approval for variant "${variantId}" does not match its current content — it was edited after approval`,
    );
    this.name = "ApprovalMismatchError";
  }
}

// Throws unless `approval` is active (not revoked) and its contentHash matches
// the variant's current content. This is the approval gate itself: callers
// (scheduler.ts, actions) must run this before ever scheduling or publishing.
export function assertValidApproval(
  variantId: string,
  approval: Approval | null | undefined,
  currentContentHash: string,
): asserts approval is Approval {
  if (!approval || approval.revokedAt) {
    throw new NotApprovedError(variantId);
  }
  if (approval.contentHash !== currentContentHash) {
    throw new ApprovalMismatchError(variantId);
  }
}

export function isApprovalValid(
  approval: Approval | null | undefined,
  currentContentHash: string,
): boolean {
  if (!approval || approval.revokedAt) return false;
  return approval.contentHash === currentContentHash;
}
