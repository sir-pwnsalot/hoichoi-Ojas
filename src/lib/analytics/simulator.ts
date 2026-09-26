import type { Channel, Format, Lang } from "@/lib/types";

// Deterministic metrics simulator (demo-seed). Same variantId → same numbers,
// every run. Emits PLATFORM-NATIVE payloads; ingest.ts maps them into the
// unified `metrics` store.
//
// Planted patterns (so the weekly report has something true to find):
//  - bn beats en on Instagram and Shorts (≈1.3× engagement); ≈equal on X
//  - question/comment CTA → ≈1.25× comments on Instagram
//  - posted 19:00–22:00 IST → ≈1.2× engagement on every channel
//  - more than 3 hashtags on X → ≈0.85×
//  - Shorts video has the highest share rate

export const CAPTURE_POINTS_H = [1, 6, 24, 72, 168] as const;
export type CapturePoint = (typeof CAPTURE_POINTS_H)[number];

export type CtaType = "question" | "comment" | "watch" | "link" | "other";

export interface PostFeatures {
  channel: Channel;
  lang: Lang;
  format: Format;
  ctaType: CtaType;
  hourIst: number; // 0–23, publish hour in IST
  hashtagCount: number;
  durationSec?: number | null; // video length (Shorts)
}

export interface InstagramInsights {
  platform: "instagram";
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
}
export interface XPublicMetrics {
  platform: "x";
  impression_count: number;
  like_count: number;
  retweet_count: number; // reposts
  reply_count: number;
  bookmark_count: number;
  url_link_clicks: number;
}
export interface YouTubeAnalytics {
  platform: "youtube";
  views: number;
  likes: number;
  comments: number;
  shares: number;
  averageViewDuration: number; // seconds
}
export type NativePayload = InstagramInsights | XPublicMetrics | YouTubeAnalytics;

// ── PRNG ────────────────────────────────────────────────────────────────
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Decay curve: share of the 7-day total accrued by age h ───────────────
const CURVE: [number, number][] = [
  [0, 0],
  [1, 0.08],
  [6, 0.3],
  [24, 0.6],
  [72, 0.9],
  [168, 1],
];

export function accrued(ageHours: number): number {
  if (ageHours <= 0) return 0;
  if (ageHours >= 168) return 1;
  for (let i = 1; i < CURVE.length; i++) {
    const [h1, f1] = CURVE[i];
    if (ageHours <= h1) {
      const [h0, f0] = CURVE[i - 1];
      return f0 + ((f1 - f0) * (ageHours - h0)) / (h1 - h0);
    }
  }
  return 1;
}

// ── Model ───────────────────────────────────────────────────────────────
const BASE_IMPRESSIONS: Record<Channel, number> = { instagram: 9000, x: 6000, youtube: 14000 };

// per-impression base rates (7-day totals)
const BASE_RATES = {
  instagram: { likes: 0.045, comments: 0.004, saves: 0.008, shares: 0.005 },
  x: { likes: 0.018, replies: 0.002, reposts: 0.003, bookmarks: 0.002, linkClicks: 0.006 },
  youtube: { likes: 0.04, comments: 0.003, shares: 0.012 },
} as const;

export const MULTIPLIERS = {
  bnOnIgYt: 1.3,
  primeTime: 1.2,
  questionCommentsIg: 1.25,
  xHashtagPenalty: 0.85,
} as const;

export function isPrimeTime(hourIst: number): boolean {
  return hourIst >= 19 && hourIst <= 22;
}

// Engagement multiplier from features (before noise).
export function engagementMultiplier(f: PostFeatures): number {
  let m = 1;
  if (f.lang === "bn" && (f.channel === "instagram" || f.channel === "youtube")) m *= MULTIPLIERS.bnOnIgYt;
  if (isPrimeTime(f.hourIst)) m *= MULTIPLIERS.primeTime;
  if (f.channel === "x" && f.hashtagCount > 3) m *= MULTIPLIERS.xHashtagPenalty;
  return m;
}

// 7-day totals, fully determined by (variantId, features).
function finalTotals(variantId: string, f: PostFeatures) {
  const rnd = mulberry32(hashSeed(variantId));
  const noise = () => 0.85 + 0.3 * rnd(); // ±15%
  const impressions = BASE_IMPRESSIONS[f.channel] * (isPrimeTime(f.hourIst) ? 1.1 : 1) * noise();
  const m = engagementMultiplier(f);
  const n = (rate: number, extra = 1) => impressions * rate * m * extra * noise();

  switch (f.channel) {
    case "instagram": {
      const r = BASE_RATES.instagram;
      const q = f.ctaType === "question" || f.ctaType === "comment" ? MULTIPLIERS.questionCommentsIg : 1;
      return {
        impressions,
        reach: impressions * (0.68 + 0.08 * rnd()),
        likes: n(r.likes),
        comments: n(r.comments, q),
        saves: n(r.saves),
        shares: n(r.shares),
      };
    }
    case "x": {
      const r = BASE_RATES.x;
      return {
        impressions,
        likes: n(r.likes),
        replies: n(r.replies),
        reposts: n(r.reposts),
        bookmarks: n(r.bookmarks),
        linkClicks: n(r.linkClicks, f.ctaType === "link" ? 1.3 : 1),
      };
    }
    case "youtube": {
      const r = BASE_RATES.youtube;
      const duration = f.durationSec ?? 20;
      const completion = Math.min(0.95, 0.5 * (f.lang === "bn" ? 1.1 : 1) * noise());
      return {
        impressions,
        likes: n(r.likes),
        comments: n(r.comments),
        shares: n(r.shares),
        avgViewDuration: duration * completion,
      };
    }
  }
}

// Native payload as the platform would report it at `ageHours` after publish.
export function simulate(variantId: string, f: PostFeatures, ageHours: number): NativePayload {
  const k = accrued(ageHours);
  const at = (x: number) => Math.round(x * k);
  const t = finalTotals(variantId, f);
  switch (f.channel) {
    case "instagram": {
      const x = t as Extract<ReturnType<typeof finalTotals>, { reach: number }>;
      return {
        platform: "instagram",
        impressions: at(x.impressions),
        reach: at(x.reach),
        likes: at(x.likes),
        comments: at(x.comments),
        saves: at(x.saves),
        shares: at(x.shares),
      };
    }
    case "x": {
      const x = t as Extract<ReturnType<typeof finalTotals>, { reposts: number }>;
      return {
        platform: "x",
        impression_count: at(x.impressions),
        like_count: at(x.likes),
        retweet_count: at(x.reposts),
        reply_count: at(x.replies),
        bookmark_count: at(x.bookmarks),
        url_link_clicks: at(x.linkClicks),
      };
    }
    case "youtube": {
      const x = t as Extract<ReturnType<typeof finalTotals>, { avgViewDuration: number }>;
      return {
        platform: "youtube",
        views: at(x.impressions),
        likes: at(x.likes),
        comments: at(x.comments),
        shares: at(x.shares),
        averageViewDuration: Math.round(x.avgViewDuration * 10) / 10,
      };
    }
  }
}

// ── Feature extraction from a stored variant ─────────────────────────────
export function ctaTypeOf(planCtaType: string | null | undefined, cta: string): CtaType {
  const s = `${planCtaType ?? ""} ${cta}`.toLowerCase();
  if (/question|\?|？/.test(s)) return "question";
  if (/comment|কমেন্ট|reply/.test(s)) return "comment";
  if (/link|click|bio|লিংক/.test(s)) return "link";
  if (/watch|stream|দেখ/.test(s)) return "watch";
  return "other";
}

export function hourIst(d: Date): number {
  return new Date(d.getTime() + 5.5 * 3600_000).getUTCHours();
}
