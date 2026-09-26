import { describe, expect, it } from "vitest";
import { schedule } from "@/lib/domain/scheduler";
import { computeContentHash } from "@/lib/domain/approval";
import { IllegalTransitionError } from "@/lib/domain/status";
import { NotApprovedError, ApprovalMismatchError } from "@/lib/domain/approval";
import type { Variant, Approval } from "@/lib/types";

function makeVariant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: "P-0001",
    conceptId: "C-1",
    channel: "instagram",
    lang: "en",
    format: "image",
    caption: "Watch tonight's episode!",
    hashtags: ["#hoichoi"],
    cta: "Watch now",
    hook: "You won't believe episode 5",
    planJson: null,
    imagePrompt: "a dramatic still from a bengali drama series",
    baseImageUrls: [],
    imageProvider: null,
    imageSeed: null,
    tailoring: null,
    assetUrl: "https://blob.example/a.png",
    assetSha256: "abc123",
    width: 1080,
    height: 1350,
    bytes: 200_000,
    durationSec: null,
    criticJson: null,
    status: "approved",
    version: 1,
    parentId: null,
    discardNote: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function currentHashFor(variant: Variant): string {
  return computeContentHash({
    caption: variant.caption,
    hashtags: variant.hashtags,
    cta: variant.cta,
    hook: variant.hook,
    assetUrl: variant.assetUrl,
    assetSha256: variant.assetSha256,
  });
}

function makeApproval(variant: Variant, overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    variantId: variant.id,
    approver: "editor@hoichoi.tv",
    contentHash: currentHashFor(variant),
    approvedAt: new Date(),
    revokedAt: null,
    ...overrides,
  };
}

describe("schedule() — the approval gate", () => {
  it("schedules an approved variant with a valid matching approval", () => {
    const variant = makeVariant({ status: "approved" });
    const approval = makeApproval(variant);
    expect(schedule(variant, approval)).toEqual({ status: "scheduled" });
  });

  it("throws NotApprovedError when there is no approval at all", () => {
    const variant = makeVariant({ status: "approved" });
    expect(() => schedule(variant, null)).toThrow(NotApprovedError);
  });

  it("throws NotApprovedError when the approval was revoked", () => {
    const variant = makeVariant({ status: "approved" });
    const approval = makeApproval(variant, { revokedAt: new Date() });
    expect(() => schedule(variant, approval)).toThrow(NotApprovedError);
  });

  it("editing the variant after approval clears it: schedule then throws ApprovalMismatchError", () => {
    const variant = makeVariant({ status: "approved" });
    const approval = makeApproval(variant);
    // Simulate an edit after approval: caption changed, approval row untouched.
    const editedVariant = { ...variant, caption: "A brand new caption written after approval" };
    expect(() => schedule(editedVariant, approval)).toThrow(ApprovalMismatchError);
  });

  it("throws IllegalTransitionError when the variant isn't in approved status", () => {
    const draftVariant = makeVariant({ status: "draft" });
    const approval = makeApproval(draftVariant);
    expect(() => schedule(draftVariant, approval)).toThrow(IllegalTransitionError);

    const publishedVariant = makeVariant({ status: "published" });
    expect(() => schedule(publishedVariant, makeApproval(publishedVariant))).toThrow(
      IllegalTransitionError,
    );
  });
});
