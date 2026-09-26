import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { metrics } from "@/db/schema";
import { approveVariant } from "@/lib/actions/variants";
import { scheduleVariant } from "@/lib/actions/publish";
import { getComparison } from "@/lib/actions/analytics";
import { runSchedulerTick } from "@/lib/domain/scheduler";
import { advanceClock, now, CLOCK_PRESETS } from "@/lib/domain/clock";
import { toMetrics } from "@/lib/analytics/ingest";
import { seedVariant } from "../actions/seed";

describe("ingest", () => {
  it("maps native payloads into the unified store", () => {
    expect(
      toMetrics({
        platform: "x",
        impression_count: 100,
        like_count: 5,
        retweet_count: 2,
        reply_count: 1,
        bookmark_count: 3,
        url_link_clicks: 4,
      }),
    ).toMatchObject({ impressions: 100, likes: 5, shares: 2, comments: 1, saves: 3, clicks: 4 });
    expect(
      toMetrics({ platform: "youtube", views: 10, likes: 1, comments: 0, shares: 2, averageViewDuration: 7.5 }),
    ).toMatchObject({ impressions: 10, views: 10, watchTimeSec: 75, shares: 2 });
  });

  it("scheduler tick snapshots published posts at each capture point the clock passes (idempotently)", async () => {
    const id = await seedVariant({ channel: "instagram" });
    await approveVariant(id, "editor");
    await scheduleVariant(id, new Date((await now()).getTime() - 1000));
    expect((await runSchedulerTick()).published).toContain(id);
    const rows = () => db.select().from(metrics).where(eq(metrics.variantId, id));
    expect(await rows()).toHaveLength(0);

    await advanceClock(CLOCK_PRESETS["+1d"]);
    expect((await runSchedulerTick()).captured).toBeGreaterThanOrEqual(3);
    const got = await rows();
    expect(got.map((r) => r.ageHours).sort((a, b) => a! - b!)).toEqual([1, 6, 24]);
    expect(got[0].rawJson).toHaveProperty("platform", "instagram");

    await runSchedulerTick(); // no duplicates
    expect(await rows()).toHaveLength(3);
    expect((await getComparison()).some((r) => r.variantId === id && r.ageHours === 24)).toBe(true);
  });
});
