import { transition } from "./status";
import { assertValidApproval, computeContentHash } from "./approval";
import type { Variant, Approval, VariantStatus } from "@/lib/types";

export interface ScheduleResult {
  status: VariantStatus; // "scheduled"
}

// The approval gate (non-negotiable #3), in one place. Throws:
//  - IllegalTransitionError if the variant isn't in "approved" status
//  - NotApprovedError if there's no active approval
//  - ApprovalMismatchError if the variant was edited after approval (hash drift)
export function schedule(
  variant: Variant,
  approval: Approval | null | undefined,
): ScheduleResult {
  const nextStatus = transition(variant.status, "schedule");
  const currentHash = computeContentHash({
    caption: variant.caption,
    hashtags: variant.hashtags,
    cta: variant.cta,
    hook: variant.hook,
    assetUrl: variant.assetUrl,
    assetSha256: variant.assetSha256,
  });
  assertValidApproval(variant.id, approval, currentHash);
  return { status: nextStatus };
}
