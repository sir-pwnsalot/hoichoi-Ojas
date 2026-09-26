import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { approvals, publishAttempts, variants } from "@/db/schema";
import { approveVariant, getVariant } from "@/lib/actions/variants";
import { scheduleVariant } from "@/lib/actions/publish";
import { runSchedulerTick } from "@/lib/domain/scheduler";
import { advanceClock, now, CLOCK_PRESETS } from "@/lib/domain/clock";
import { seedVariant } from "../actions/seed";

const attempts = (id: string) => db.select().from(publishAttempts).where(eq(publishAttempts.variantId, id));
const reasonCodes = (a: { reasons: unknown }) => ((a.reasons ?? []) as { code: string }[]).map((r) => r.code).sort();

async function approvedAndScheduled(opts: Parameters<typeof seedVariant>[0], inMs: number) {
  const id = await seedVariant(opts);
  await approveVariant(id, "editor");
  await scheduleVariant(id, new Date((await now()).getTime() + inMs));
  return id;
}

describe("runSchedulerTick", () => {
  it("publishes due posts through the adapter; logs the attempt with externalId", async () => {
    const id = await approvedAndScheduled({ channel: "youtube" }, -1000);
    const res = await runSchedulerTick();
    expect(res.published).toContain(id);
    expect((await getVariant(id))!.status).toBe("published");
    const [a] = await attempts(id);
    expect(a).toMatchObject({ ok: true, channel: "youtube", source: "scheduler" });
    expect(a.externalId).toMatch(/^yt_/);
  });

  it("leaves future posts alone until the clock is advanced", async () => {
    const id = await approvedAndScheduled({ channel: "x" }, 3 * 3600_000);
    expect((await runSchedulerTick()).published).not.toContain(id);
    expect((await getVariant(id))!.status).toBe("scheduled");
    await advanceClock(CLOCK_PRESETS["+6h"]);
    expect((await runSchedulerTick()).published).toContain(id);
  });

  it("re-checks the approval: revoked approval → rejected with NOT_APPROVED, adapter never called", async () => {
    const id = await approvedAndScheduled({ channel: "instagram" }, -1000);
    await db
      .update(approvals)
      .set({ revokedAt: new Date() })
      .where(and(eq(approvals.variantId, id), isNull(approvals.revokedAt)));
    const res = await runSchedulerTick();
    expect(res.rejected).toContain(id);
    expect((await getVariant(id))!.status).toBe("rejected");
    const [a] = await attempts(id);
    expect(a.ok).toBe(false);
    expect(reasonCodes(a)).toEqual(["NOT_APPROVED"]);
  });

  it("content drift after scheduling → NOT_APPROVED", async () => {
    const id = await approvedAndScheduled({ channel: "x" }, -1000);
    await db.update(variants).set({ caption: "changed after approval" }).where(eq(variants.id, id));
    await runSchedulerTick();
    expect(reasonCodes((await attempts(id))[0])).toEqual(["NOT_APPROVED"]);
  });

  it("adapter violations → rejected with typed reasons (all of them)", async () => {
    const id = await approvedAndScheduled({ channel: "youtube", asset: "yt-square.mp4" }, -1000);
    const res = await runSchedulerTick();
    expect(res.rejected).toContain(id);
    expect(reasonCodes((await attempts(id))[0])).toEqual(["ASPECT_RATIO", "DIMENSIONS"]);
  });

  it("an approved variant with no composed asset is rejected (FORMAT), never published", async () => {
    const id = await approvedAndScheduled({ channel: "instagram", asset: null }, -1000);
    await runSchedulerTick();
    expect((await getVariant(id))!.status).toBe("rejected");
    expect(reasonCodes((await attempts(id))[0])).toEqual(["FORMAT"]);
  });

  it("is idempotent: a second tick doesn't republish", async () => {
    const id = await approvedAndScheduled({ channel: "x" }, -1000);
    await runSchedulerTick();
    await runSchedulerTick();
    expect(await attempts(id)).toHaveLength(1);
  });
});
