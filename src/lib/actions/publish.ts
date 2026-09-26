"use server";

import { randomUUID } from "node:crypto";
import { schedule } from "@/lib/domain/scheduler";
import { computeContentHash } from "@/lib/domain/approval";
import type { Approval, Channel, PublishAttempt, Rejection, Schedule, Variant } from "@/lib/types";

// M0 stub: returns realistic mock data with the final shape. `scheduleVariant`
// already runs through the real approval gate (src/lib/domain/scheduler.ts) —
// non-negotiable #3 — so a variant without a valid matching approval throws
// here exactly as it will once wired to src/db in M4.

function mockApprovedVariant(variantId: string): { variant: Variant; approval: Approval } {
  const variant: Variant = {
    id: variantId,
    conceptId: "concept-mock",
    channel: "instagram",
    lang: "bn",
    format: "image",
    caption: "আজ রাতে নতুন পর্ব — মিস করবেন না!",
    hashtags: ["#hoichoi"],
    cta: "এখনই দেখুন",
    hook: "এই মোড় আপনাকে চমকে দেবে",
    planJson: null,
    imagePrompt: "cinematic still from a bengali drama series",
    assetUrl: "https://blob.example/p-mock.png",
    assetSha256: "mock-sha256",
    width: 1080,
    height: 1350,
    bytes: 512_000,
    durationSec: null,
    criticJson: null,
    status: "approved",
    version: 1,
    parentId: null,
    discardNote: null,
    createdAt: new Date(),
  };
  const approval: Approval = {
    id: randomUUID(),
    variantId,
    approver: "editor@hoichoi.tv",
    contentHash: computeContentHash({
      caption: variant.caption,
      hashtags: variant.hashtags,
      cta: variant.cta,
      hook: variant.hook,
      assetUrl: variant.assetUrl,
      assetSha256: variant.assetSha256,
    }),
    approvedAt: new Date(),
    revokedAt: null,
  };
  return { variant, approval };
}

export async function scheduleVariant(variantId: string, scheduledFor: Date): Promise<Schedule> {
  const { variant, approval } = mockApprovedVariant(variantId);
  schedule(variant, approval); // throws NotApprovedError / ApprovalMismatchError / IllegalTransitionError
  return {
    id: randomUUID(),
    variantId,
    scheduledFor,
    createdAt: new Date(),
  };
}

export interface RunSchedulerTickResult {
  published: string[];
  rejected: string[];
}

// Ticks every "scheduled" variant against its adapter's validate(): passes
// become "published" with an externalId, failures become "rejected" with
// typed reasons. Every attempt is logged (adapter-contracts, M4).
export async function runSchedulerTick(): Promise<RunSchedulerTickResult> {
  return { published: [], rejected: [] };
}

export type RuleBreakerKind =
  | "oversized_image"
  | "wrong_ratio_video"
  | "long_caption"
  | "custom";

export interface RuleBreakerPayload {
  channel: Channel;
  caption?: string;
  hashtags?: string[];
  assetUrl?: string;
}

const RULE_BREAKER_REJECTIONS: Record<Exclude<RuleBreakerKind, "custom">, Rejection[]> = {
  oversized_image: [
    {
      code: "FILE_TOO_LARGE",
      field: "asset",
      limit: "8 MB",
      actual: "11 MB",
      message: "Instagram feed images must be 8 MB or smaller.",
    },
  ],
  wrong_ratio_video: [
    {
      code: "ASPECT_RATIO",
      field: "asset",
      limit: "9:16",
      actual: "1:1",
      message: "YouTube Shorts require a 9:16 aspect ratio.",
    },
  ],
  long_caption: [
    {
      code: "CAPTION_TOO_LONG",
      field: "caption",
      limit: 280,
      actual: 310,
      message: "X captions must be 280 weighted characters or fewer.",
    },
  ],
};

// Demo panel: submits a payload that violates a platform constraint and shows
// the real (typed) rejection instead of silently accepting or auto-fixing it.
export async function submitRuleBreaker(
  kind: RuleBreakerKind,
  payload?: RuleBreakerPayload,
): Promise<{ ok: boolean; rejections: Rejection[] }> {
  if (kind === "custom") {
    return { ok: !payload, rejections: payload ? [] : [] };
  }
  return { ok: false, rejections: RULE_BREAKER_REJECTIONS[kind] };
}

export async function listPublishAttempts(variantId?: string): Promise<PublishAttempt[]> {
  return [
    {
      id: randomUUID(),
      variantId: variantId ?? "P-mock",
      attemptedAt: new Date(),
      ok: true,
      externalId: "ig_mockexternal",
      reasons: null,
    },
  ];
}
