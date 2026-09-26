import type { VariantStatus } from "@/lib/types";

export type VariantAction =
  | "approve"
  | "edit"
  | "schedule"
  | "tick_ok"
  | "tick_fail"
  | "discard"
  | "regenerate";

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: VariantStatus,
    public readonly action: VariantAction,
  ) {
    super(`Illegal transition: cannot "${action}" from status "${from}"`);
    this.name = "IllegalTransitionError";
  }
}

// draft ──approve──▶ approved ──schedule──▶ scheduled ──tick_ok──▶ published
//   │                    │ edit                  └──tick_fail──▶ rejected
//   └──discard──▶ discarded ──regenerate──▶ draft (new variant, version+1, parentId)
// approved ──edit──▶ draft (approval cleared by the caller)
// rejected ──edit──▶ draft
const TRANSITIONS: Record<VariantStatus, Partial<Record<VariantAction, VariantStatus>>> = {
  draft: { approve: "approved", discard: "discarded" },
  approved: { edit: "draft", schedule: "scheduled" },
  scheduled: { tick_ok: "published", tick_fail: "rejected" },
  published: {},
  rejected: { edit: "draft" },
  discarded: { regenerate: "draft" },
};

export function transition(from: VariantStatus, action: VariantAction): VariantStatus {
  const next = TRANSITIONS[from]?.[action];
  if (!next) {
    throw new IllegalTransitionError(from, action);
  }
  return next;
}

export function canTransition(from: VariantStatus, action: VariantAction): boolean {
  return TRANSITIONS[from]?.[action] !== undefined;
}
