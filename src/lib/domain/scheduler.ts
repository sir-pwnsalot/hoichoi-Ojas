import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { schedules, variants } from "@/db/schema";
import { transition } from "./status";
import { assertValidApproval, computeContentHash, isApprovalValid } from "./approval";
import { now as appNow } from "./clock";
import { getAdapter, AdapterRejectedError } from "@/lib/adapters";
import { logAttemptToDb } from "@/lib/adapters/base";
import { payloadForVariant } from "@/lib/adapters/payload";
import { captureDue } from "@/lib/analytics/ingest";
import { activeApproval, contentHashOf, rowToVariant } from "@/lib/repo";
import type { Variant, Approval, VariantStatus, Rejection } from "@/lib/types";

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

export interface TickResult {
  published: string[];
  rejected: string[];
  captured: number; // metric snapshots written by the simulator this tick
}

// Publishes every scheduled variant whose time (app clock) has come.
// Before calling the adapter it re-checks the approval hash (NOT_APPROVED);
// the adapter then validates the real bytes itself. Every attempt is logged.
export async function runSchedulerTick(): Promise<TickResult> {
  const at = await appNow();
  const due = await db
    .select({ variant: variants })
    .from(schedules)
    .innerJoin(variants, eq(schedules.variantId, variants.id))
    .where(and(lte(schedules.scheduledFor, at), eq(variants.status, "scheduled")));

  const result: TickResult = { published: [], rejected: [], captured: 0 };
  const seen = new Set<string>();
  for (const { variant: row } of due) {
    if (seen.has(row.id)) continue; // a variant rescheduled twice publishes once
    seen.add(row.id);
    const v = rowToVariant(row);
    const approval = await activeApproval(v.id);

    let ok = false;
    if (!isApprovalValid(approval, contentHashOf(v))) {
      const reason: Rejection = {
        code: "NOT_APPROVED",
        field: "approval",
        limit: "active approval matching current content",
        actual: approval ? "content changed after approval" : "no active approval",
        message: `Variant ${v.id} is not approved in its current form; it was not sent to ${v.channel}.`,
      };
      await logAttemptToDb({ variantId: v.id, channel: v.channel, source: "scheduler", ok: false, externalId: null, reasons: [reason], attemptedAt: at });
    } else {
      try {
        await getAdapter(v.channel).publish(payloadForVariant(v)); // logs its own attempt
        ok = true;
      } catch (err) {
        if (!(err instanceof AdapterRejectedError)) throw err;
      }
    }

    const next = transition("scheduled", ok ? "tick_ok" : "tick_fail");
    await db.update(variants).set({ status: next }).where(eq(variants.id, v.id));
    (ok ? result.published : result.rejected).push(v.id);
  }
  // Simulator: snapshot every published post at each capture point the clock has passed.
  result.captured = await captureDue(at);
  return result;
}
