import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { metrics, publishAttempts, variants } from "@/db/schema";
import type { Channel, Format, Lang } from "@/lib/types";
import {
  CAPTURE_POINTS_H,
  ctaTypeOf,
  hourIst,
  simulate,
  type NativePayload,
  type PostFeatures,
} from "./simulator";

// Unified metric fields (the `metrics` row minus id/variant/time).
export interface UnifiedMetrics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  watchTimeSec: number;
  clicks: number;
}

// Native → unified. This mapping is the "one store for three platforms" story:
//  IG saves→saves · X reposts→shares, replies→comments, bookmarks→saves, link clicks→clicks
//  YT views→views AND impressions (a Shorts feed view is the impression unit), avg duration×views→watchTime
export function toMetrics(p: NativePayload): UnifiedMetrics {
  switch (p.platform) {
    case "instagram":
      return {
        impressions: p.impressions,
        reach: p.reach,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saves: p.saves,
        views: 0,
        watchTimeSec: 0,
        clicks: 0,
      };
    case "x":
      return {
        impressions: p.impression_count,
        reach: 0,
        likes: p.like_count,
        comments: p.reply_count,
        shares: p.retweet_count,
        saves: p.bookmark_count,
        views: 0,
        watchTimeSec: 0,
        clicks: p.url_link_clicks,
      };
    case "youtube":
      return {
        impressions: p.views,
        reach: 0,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saves: 0,
        views: p.views,
        watchTimeSec: Math.round(p.views * p.averageViewDuration),
        clicks: 0,
      };
  }
}

type VariantRow = typeof variants.$inferSelect;

export function featuresOf(v: VariantRow, publishedAt: Date): PostFeatures {
  const plan = v.planJson as { ctaType?: string } | null;
  return {
    channel: v.channel as Channel,
    lang: v.lang as Lang,
    format: v.format as Format,
    ctaType: ctaTypeOf(plan?.ctaType, v.cta),
    hourIst: hourIst(publishedAt),
    hashtagCount: v.hashtags.length,
    durationSec: v.durationSec,
  };
}

export const metricId = (variantId: string, ageHours: number) => `${variantId}@${ageHours}h`;

// Writes every capture point that `now` has passed for a published variant.
// Idempotent: fixed ids + ON CONFLICT DO NOTHING.
export async function captureVariant(v: VariantRow, publishedAt: Date, now: Date): Promise<number> {
  const ageMs = now.getTime() - publishedAt.getTime();
  const f = featuresOf(v, publishedAt);
  const rows = CAPTURE_POINTS_H.filter((h) => h * 3600_000 <= ageMs).map((h) => {
    const payload = simulate(v.id, f, h);
    return {
      id: metricId(v.id, h),
      variantId: v.id,
      capturedAt: new Date(publishedAt.getTime() + h * 3600_000),
      ageHours: h,
      ...toMetrics(payload),
      rawJson: payload as unknown as Record<string, unknown>,
    };
  });
  if (!rows.length) return 0;
  const res = await db.insert(metrics).values(rows).onConflictDoNothing().returning({ id: metrics.id });
  return res.length;
}

// Publish time = first successful publish attempt.
export async function publishedAtMap(variantIds?: string[]): Promise<Map<string, Date>> {
  const where = variantIds
    ? and(eq(publishAttempts.ok, true), inArray(publishAttempts.variantId, variantIds))
    : eq(publishAttempts.ok, true);
  const rows = await db
    .select({ variantId: publishAttempts.variantId, at: publishAttempts.attemptedAt })
    .from(publishAttempts)
    .where(where);
  const m = new Map<string, Date>();
  for (const r of rows) {
    if (!r.variantId) continue;
    const prev = m.get(r.variantId);
    if (!prev || r.at < prev) m.set(r.variantId, r.at);
  }
  return m;
}

// Called on every scheduler tick / clock advance: snapshot every published
// post at each capture point (1h, 6h, 24h, 72h, 7d) the app clock has passed.
export async function captureDue(now: Date): Promise<number> {
  const published = await db.select().from(variants).where(eq(variants.status, "published"));
  if (!published.length) return 0;
  const pubAt = await publishedAtMap(published.map((v) => v.id));
  let n = 0;
  for (const v of published) {
    const at = pubAt.get(v.id);
    if (at) n += await captureVariant(v, at, now);
  }
  return n;
}
