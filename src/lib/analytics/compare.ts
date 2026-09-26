import { eq } from "drizzle-orm";
import { db } from "@/db";
import { concepts, metrics, variants } from "@/db/schema";
import type { Channel, ComparisonRow, Lang } from "@/lib/types";
import type { UnifiedMetrics } from "./ingest";

// Like-for-like comparison (grounded-reporting): key = concept; compare
// normalised RATES (never raw totals) at a common age since publish.

export interface PostSnapshot {
  variantId: string;
  conceptId: string;
  conceptName: string;
  channel: Channel;
  lang: Lang;
  durationSec: number | null;
  ageHours: number;
  metrics: UnifiedMetrics;
}

export interface Rates {
  engagementRate: number;
  shareRate: number;
  saveRate: number;
  completionProxy: number | null;
}

// docs/ARCHITECTURE.md § Normalised rates
export function rates(m: UnifiedMetrics, durationSec: number | null): Rates {
  const imp = m.impressions;
  const div = (a: number, b: number) => (b > 0 ? a / b : 0);
  return {
    engagementRate: div(m.likes + m.comments + m.shares + m.saves, imp),
    shareRate: div(m.shares, imp),
    saveRate: div(m.saves, imp),
    completionProxy: durationSec && m.views > 0 ? m.watchTimeSec / (m.views * durationSec) : null,
  };
}

// Largest age at which EVERY post of the concept has a snapshot.
export function commonAge(snaps: PostSnapshot[]): number | null {
  const byPost = new Map<string, Set<number>>();
  for (const s of snaps) {
    if (!byPost.has(s.variantId)) byPost.set(s.variantId, new Set());
    byPost.get(s.variantId)!.add(s.ageHours);
  }
  const sets = [...byPost.values()];
  if (!sets.length) return null;
  const shared = [...sets[0]].filter((h) => sets.every((set) => set.has(h)));
  return shared.length ? Math.max(...shared) : null;
}

const CH_ORDER: Channel[] = ["instagram", "x", "youtube"];
const LANG_ORDER: Lang[] = ["bn", "en"];

// One row per (concept, channel, lang) at the concept's common age
// (or `atHours` if given — posts without that snapshot are left out).
export function compareConcepts(snaps: PostSnapshot[], atHours?: number): ComparisonRow[] {
  const byConcept = new Map<string, PostSnapshot[]>();
  for (const s of snaps) {
    if (!byConcept.has(s.conceptId)) byConcept.set(s.conceptId, []);
    byConcept.get(s.conceptId)!.push(s);
  }
  const out: ComparisonRow[] = [];
  for (const group of byConcept.values()) {
    const age = atHours ?? commonAge(group);
    if (age == null) continue;
    const atAge = group.filter((s) => s.ageHours === age);
    atAge.sort(
      (a, b) =>
        CH_ORDER.indexOf(a.channel) - CH_ORDER.indexOf(b.channel) ||
        LANG_ORDER.indexOf(a.lang) - LANG_ORDER.indexOf(b.lang) ||
        a.variantId.localeCompare(b.variantId),
    );
    for (const s of atAge) {
      out.push({
        conceptId: s.conceptId,
        conceptName: s.conceptName,
        channel: s.channel,
        lang: s.lang,
        variantId: s.variantId,
        ageHours: age,
        ...rates(s.metrics, s.durationSec),
        impressions: s.metrics.impressions,
      });
    }
  }
  return out;
}

export interface LangSplitRow {
  conceptId: string | null; // null = mean across all concepts
  conceptName: string;
  channel: Channel;
  bn: Rates | null;
  en: Rates | null;
  bnPostIds: string[];
  enPostIds: string[];
  // bn engagement ÷ en engagement − 1 (e.g. 0.3 = bn +30%); null if a side is missing
  bnLift: number | null;
}

function meanRates(rows: ComparisonRow[]): Rates | null {
  if (!rows.length) return null;
  const avg = (f: (r: ComparisonRow) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
  const cps = rows.map((r) => r.completionProxy).filter((x): x is number => x != null);
  return {
    engagementRate: avg((r) => r.engagementRate),
    shareRate: avg((r) => r.shareRate),
    saveRate: avg((r) => r.saveRate),
    completionProxy: cps.length ? cps.reduce((a, b) => a + b, 0) / cps.length : null,
  };
}

// bn vs en on the SAME channel: per concept, plus an across-concepts mean
// per channel (unweighted mean of per-post rates).
export function bnVsEn(rows: ComparisonRow[]): LangSplitRow[] {
  const split = (group: ComparisonRow[], conceptId: string | null, conceptName: string, channel: Channel): LangSplitRow => {
    const bnRows = group.filter((r) => r.lang === "bn");
    const enRows = group.filter((r) => r.lang === "en");
    const bn = meanRates(bnRows);
    const en = meanRates(enRows);
    return {
      conceptId,
      conceptName,
      channel,
      bn,
      en,
      bnPostIds: bnRows.map((r) => r.variantId),
      enPostIds: enRows.map((r) => r.variantId),
      bnLift: bn && en && en.engagementRate > 0 ? bn.engagementRate / en.engagementRate - 1 : null,
    };
  };

  const out: LangSplitRow[] = [];
  const conceptIds = [...new Set(rows.map((r) => r.conceptId))];
  for (const cid of conceptIds) {
    const cr = rows.filter((r) => r.conceptId === cid);
    for (const ch of CH_ORDER) {
      const g = cr.filter((r) => r.channel === ch);
      if (g.length) out.push(split(g, cid, g[0].conceptName, ch));
    }
  }
  for (const ch of CH_ORDER) {
    const g = rows.filter((r) => r.channel === ch);
    if (g.length) out.push(split(g, null, "All concepts", ch));
  }
  return out;
}

// ── DB loader ───────────────────────────────────────────────────────────
export async function loadSnapshots(briefId?: string): Promise<PostSnapshot[]> {
  const q = db
    .select({ m: metrics, v: variants, c: concepts })
    .from(metrics)
    .innerJoin(variants, eq(metrics.variantId, variants.id))
    .innerJoin(concepts, eq(variants.conceptId, concepts.id));
  const rows = briefId ? await q.where(eq(concepts.briefId, briefId)) : await q;
  return rows
    .filter((r) => r.m.ageHours != null)
    .map(({ m, v, c }) => ({
      variantId: v.id,
      conceptId: c.id,
      conceptName: c.name,
      channel: v.channel as Channel,
      lang: v.lang as Lang,
      durationSec: v.durationSec,
      ageHours: m.ageHours!,
      metrics: {
        impressions: m.impressions,
        reach: m.reach,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        saves: m.saves,
        views: m.views,
        watchTimeSec: m.watchTimeSec,
        clicks: m.clicks,
      },
    }));
}
