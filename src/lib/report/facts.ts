import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { publishAttempts, variants } from "@/db/schema";
import { compareConcepts, loadSnapshots } from "@/lib/analytics/compare";
import type { Channel, ComparisonRow, Format, Lang } from "@/lib/types";

// The week's facts table, computed entirely in code (grounded-reporting).
// The LLM only ever quotes these numbers; verify.ts checks it did.
// Units are what the report displays: rates in % (2 dp), lifts in % (1 dp).

export interface PostFact {
  id: string;
  conceptId: string;
  conceptName: string;
  channel: Channel;
  lang: Lang;
  format: Format;
  ctaType: string;
  hook: string;
  publishedAt: string; // ISO
  hourIST: number;
  ageHours: number; // like-for-like capture point the rates were taken at
  engagementRate: number; // %
  shareRate: number; // %
  saveRate: number; // %
  completionProxy: number | null; // %
  impressions: number;
}

export interface AggregateFact {
  key: string; // e.g. "er.instagram.bn", "bnLift.youtube", "er.cta.question"
  label: string;
  value: number;
  postIds: string[];
}

export interface WeekFacts {
  weekStart: string;
  weekEnd: string;
  posts: PostFact[];
  aggregates: AggregateFact[];
  // Real posts published outside the week — lets the verifier tell
  // "outside the report week" apart from "does not exist".
  otherPostIds: string[];
}

export const POST_METRICS = ["engagementRate", "shareRate", "saveRate", "completionProxy", "impressions"] as const;
export type PostMetric = (typeof POST_METRICS)[number];

export const WEEK_MS = 7 * 86_400_000;
const IST_MS = 5.5 * 3600_000;
const r2 = (x: number) => Math.round(x * 100) / 100;
const r1 = (x: number) => Math.round(x * 10) / 10;
const pct = (x: number) => r2(x * 100);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export interface FactInput {
  row: ComparisonRow;
  publishedAt: Date;
  format: Format;
  ctaType: string;
  hook: string;
}

export function toPostFact({ row, publishedAt, format, ctaType, hook }: FactInput): PostFact {
  return {
    id: row.variantId,
    conceptId: row.conceptId,
    conceptName: row.conceptName,
    channel: row.channel,
    lang: row.lang,
    format,
    ctaType,
    hook,
    publishedAt: publishedAt.toISOString(),
    hourIST: new Date(publishedAt.getTime() + IST_MS).getUTCHours(),
    ageHours: row.ageHours ?? 0,
    engagementRate: pct(row.engagementRate),
    shareRate: pct(row.shareRate),
    saveRate: pct(row.saveRate),
    completionProxy: row.completionProxy == null ? null : pct(row.completionProxy),
    impressions: row.impressions,
  };
}

// Pre-computed comparisons so the model never does arithmetic.
export function computeAggregates(posts: PostFact[]): AggregateFact[] {
  const out: AggregateFact[] = [];
  const add = (key: string, label: string, group: PostFact[], f: (p: PostFact) => number | null, round = r2) => {
    const vals = group.map(f).filter((v): v is number => v != null);
    if (!vals.length) return;
    out.push({ key, label, value: round(mean(vals)), postIds: group.map((p) => p.id) });
  };
  const er = (p: PostFact) => p.engagementRate;
  const channels = [...new Set(posts.map((p) => p.channel))];

  for (const ch of channels) {
    const g = posts.filter((p) => p.channel === ch);
    add(`er.${ch}`, `${ch} mean engagement rate (%)`, g, er);
    add(`shareRate.${ch}`, `${ch} mean share rate (%)`, g, (p) => p.shareRate);
    add(`saveRate.${ch}`, `${ch} mean save rate (%)`, g, (p) => p.saveRate);
    add(`completion.${ch}`, `${ch} mean completion proxy (%)`, g, (p) => p.completionProxy);
    const bn = g.filter((p) => p.lang === "bn");
    const en = g.filter((p) => p.lang === "en");
    add(`er.${ch}.bn`, `${ch} Bengali mean engagement rate (%)`, bn, er);
    add(`er.${ch}.en`, `${ch} English mean engagement rate (%)`, en, er);
    if (bn.length && en.length) {
      const b = mean(bn.map(er));
      const e = mean(en.map(er));
      if (e > 0) {
        out.push({
          key: `bnLift.${ch}`,
          label: `${ch} Bengali vs English engagement lift (%)`,
          value: r1((b / e - 1) * 100),
          postIds: g.map((p) => p.id),
        });
      }
    }
  }
  for (const lang of ["bn", "en"] as const) {
    add(`er.lang.${lang}`, `${lang} mean engagement rate, all channels (%)`, posts.filter((p) => p.lang === lang), er);
  }
  for (const cta of [...new Set(posts.map((p) => p.ctaType))]) {
    add(`er.cta.${cta}`, `"${cta}" CTA mean engagement rate (%)`, posts.filter((p) => p.ctaType === cta), er);
  }
  for (const fmt of [...new Set(posts.map((p) => p.format))]) {
    add(`er.format.${fmt}`, `${fmt} mean engagement rate (%)`, posts.filter((p) => p.format === fmt), er);
  }
  add("er.time.evening", "posted 18:00–23:59 IST mean engagement rate (%)", posts.filter((p) => p.hourIST >= 18), er);
  add("er.time.daytime", "posted before 18:00 IST mean engagement rate (%)", posts.filter((p) => p.hourIST < 18), er);

  const byEr = [...posts].sort((a, b) => b.engagementRate - a.engagementRate || a.id.localeCompare(b.id));
  if (byEr.length) {
    out.push({ key: "top.engagementRate", label: `top post engagement rate (%)`, value: byEr[0].engagementRate, postIds: [byEr[0].id] });
    const last = byEr[byEr.length - 1];
    out.push({ key: "bottom.engagementRate", label: `bottom post engagement rate (%)`, value: last.engagementRate, postIds: [last.id] });
  }
  return out;
}

export function buildWeekFacts(inputs: FactInput[], weekStart: Date, otherPostIds: string[]): WeekFacts {
  const posts = inputs.map(toPostFact).sort((a, b) => a.id.localeCompare(b.id));
  return {
    weekStart: weekStart.toISOString(),
    weekEnd: new Date(weekStart.getTime() + WEEK_MS).toISOString(),
    posts,
    aggregates: computeAggregates(posts),
    otherPostIds,
  };
}

// ── DB loader ───────────────────────────────────────────────────────────
// Week = posts whose first successful publish falls in [weekStart, +7d).
export async function loadWeekFacts(weekStart: Date): Promise<WeekFacts> {
  const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
  const published = await db
    .select({ variantId: publishAttempts.variantId, at: publishAttempts.attemptedAt })
    .from(publishAttempts)
    .where(eq(publishAttempts.ok, true));
  const firstPublish = new Map<string, Date>();
  for (const p of published) {
    if (!p.variantId) continue;
    const prev = firstPublish.get(p.variantId);
    if (!prev || p.at < prev) firstPublish.set(p.variantId, p.at);
  }
  const inWeek = (d: Date) => d >= weekStart && d < weekEnd;

  const snaps = await loadSnapshots();
  const vrows = await db.select().from(variants);
  const vById = new Map(vrows.map((v) => [v.id, v]));

  const rows = compareConcepts(snaps.filter((s) => inWeek(firstPublish.get(s.variantId) ?? new Date(0))));
  const inputs: FactInput[] = rows.map((row) => {
    const v = vById.get(row.variantId)!;
    const plan = (v.planJson ?? {}) as { ctaType?: string };
    return {
      row,
      publishedAt: firstPublish.get(row.variantId)!,
      format: v.format as Format,
      ctaType: plan.ctaType ?? "unknown",
      hook: v.hook,
    };
  });
  const inWeekIds = new Set(inputs.map((i) => i.row.variantId));
  const otherPostIds = vrows.map((v) => v.id).filter((id) => !inWeekIds.has(id));
  return buildWeekFacts(inputs, weekStart, otherPostIds);
}

// Posts published in a window, for choosing a default report week.
export async function countPublishedBetween(from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ id: publishAttempts.id })
    .from(publishAttempts)
    .where(and(eq(publishAttempts.ok, true), gte(publishAttempts.attemptedAt, from), lt(publishAttempts.attemptedAt, to)));
  return rows.length;
}
