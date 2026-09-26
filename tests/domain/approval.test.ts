import { describe, expect, it } from "vitest";
import {
  computeContentHash,
  isApprovalValid,
  assertValidApproval,
  NotApprovedError,
  ApprovalMismatchError,
} from "@/lib/domain/approval";
import type { Approval } from "@/lib/types";

const baseContent = {
  caption: "Watch tonight's episode!",
  hashtags: ["#hoichoi", "#bangla"],
  cta: "Watch now",
  hook: "You won't believe episode 5",
  assetUrl: "https://blob.example/a.png",
  assetSha256: "abc123",
};

function makeApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    variantId: "P-0001",
    approver: "editor@hoichoi.tv",
    contentHash: computeContentHash(baseContent),
    approvedAt: new Date(),
    revokedAt: null,
    ...overrides,
  };
}

describe("computeContentHash", () => {
  it("is deterministic for identical content", () => {
    expect(computeContentHash(baseContent)).toBe(computeContentHash({ ...baseContent }));
  });

  it("is independent of hashtag order", () => {
    const reordered = { ...baseContent, hashtags: [...baseContent.hashtags].reverse() };
    expect(computeContentHash(baseContent)).toBe(computeContentHash(reordered));
  });

  it("changes when the caption changes", () => {
    const edited = { ...baseContent, caption: "Different caption" };
    expect(computeContentHash(baseContent)).not.toBe(computeContentHash(edited));
  });

  it("changes when the asset changes", () => {
    const edited = { ...baseContent, assetSha256: "different-hash" };
    expect(computeContentHash(baseContent)).not.toBe(computeContentHash(edited));
  });
});

describe("approval gate", () => {
  it("is valid when hash matches and not revoked", () => {
    const approval = makeApproval();
    expect(isApprovalValid(approval, computeContentHash(baseContent))).toBe(true);
  });

  it("is invalid, and asserting throws NotApprovedError, when there is no approval", () => {
    expect(isApprovalValid(null, computeContentHash(baseContent))).toBe(false);
    expect(() =>
      assertValidApproval("P-0001", null, computeContentHash(baseContent)),
    ).toThrow(NotApprovedError);
  });

  it("is invalid, and asserting throws NotApprovedError, when the approval was revoked", () => {
    const approval = makeApproval({ revokedAt: new Date() });
    expect(isApprovalValid(approval, computeContentHash(baseContent))).toBe(false);
    expect(() =>
      assertValidApproval("P-0001", approval, computeContentHash(baseContent)),
    ).toThrow(NotApprovedError);
  });

  it("editing content after approval invalidates it (hash mismatch)", () => {
    const approval = makeApproval();
    const editedContent = { ...baseContent, caption: "A caption added after approval" };
    const editedHash = computeContentHash(editedContent);
    expect(isApprovalValid(approval, editedHash)).toBe(false);
    expect(() => assertValidApproval("P-0001", approval, editedHash)).toThrow(
      ApprovalMismatchError,
    );
  });
});
