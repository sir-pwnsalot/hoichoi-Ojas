// Shared domain types — the contract between src/lib (Claude Code) and src/app, src/components (Antigravity).
// Do not change shapes here without a docs/HANDOFF.md note; the UI is built against these.

export type Channel = "instagram" | "x" | "youtube";
export type Lang = "bn" | "en";
export type Format = "image" | "video";

export type VariantStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "discarded";

export type Lever = "lang" | "channel" | "cta" | "time" | "format" | "hook";

export interface Brief {
  id: string;
  title: string;
  show: string;
  keyMessage: string;
  audience: string;
  languages: Lang[];
  tone: string;
  ctaGoal: string;
  rawText: string | null;
  briefLang: Lang;
  appliedInsightIds: string[];
  createdAt: Date;
}

export interface BriefInput {
  title: string;
  show: string;
  keyMessage: string;
  audience: string;
  languages: Lang[];
  tone: string;
  ctaGoal: string;
  rawText?: string;
  briefLang: Lang;
  appliedInsightIds?: string[];
}

export interface Concept {
  id: string;
  briefId: string;
  name: string;
  createdAt: Date;
}

export interface CriticResult {
  score: number; // 1-5 nativeness score; < 4 triggers one regeneration
  isTranslation: boolean;
  flaggedPhrases: string[];
  notes: string | null;
}

export interface AppliedInsight {
  insightId: string;
  howApplied: string;
}

export interface CreativePlan {
  channel: Channel;
  angle: string;
  hook: string;
  tone: string;
  length: string;
  ctaType: string;
  hashtagStrategy: string;
  visualComposition: string;
  imagePrompt: string;
  appliedInsights: AppliedInsight[];
}

export interface SimilarityPair {
  a: Channel;
  b: Channel;
  similarity: number; // 0..1, 1 - hamming/64 of 64-bit dHash
  flagged: boolean; // similarity > threshold
}

export interface TailoringReport {
  threshold: number; // 0.85
  pairs: SimilarityPair[];
  maxSimilarity: number;
  flagged: boolean;
  computedAt: string; // ISO
}

export interface Variant {
  id: string; // public postId, e.g. "P-0001"
  conceptId: string;
  channel: Channel;
  lang: Lang;
  format: Format;
  caption: string;
  hashtags: string[];
  cta: string;
  hook: string;
  planJson: CreativePlan | null;
  imagePrompt: string;
  // M2 fields: always set by src/lib; optional only so UI-side mock literals keep compiling.
  baseImageUrls?: string[]; // generated text-free base images; fetch via GET /api/base-image?variantId=&frame=
  imageProvider?: string | null;
  imageSeed?: number | null;
  tailoring?: TailoringReport | null; // the concept's cross-channel dHash report
  assetUrl: string | null;
  assetSha256: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  durationSec: number | null;
  criticJson: CriticResult | null;
  status: VariantStatus;
  version: number;
  parentId: string | null;
  discardNote: string | null;
  createdAt: Date;
}

export interface Approval {
  id: string;
  variantId: string;
  approver: string;
  contentHash: string;
  approvedAt: Date;
  revokedAt: Date | null;
}

export interface Schedule {
  id: string;
  variantId: string;
  scheduledFor: Date;
  createdAt: Date;
}

export type RejectionCode =
  | "NOT_APPROVED"
  | "ASPECT_RATIO"
  | "DIMENSIONS"
  | "FILE_TOO_LARGE"
  | "FORMAT"
  | "DURATION"
  | "CAPTION_TOO_LONG"
  | "TITLE_TOO_LONG"
  | "TOO_MANY_HASHTAGS"
  | "EMPTY_CAPTION";

export interface Rejection {
  code: RejectionCode;
  field: string;
  limit: string | number;
  actual: string | number;
  message: string;
}

export interface PublishAttempt {
  id: string;
  variantId: string | null; // null for rule-breaker demo payloads
  channel: Channel;
  source: "scheduler" | "rule_breaker";
  attemptedAt: Date;
  ok: boolean;
  externalId: string | null;
  reasons: Rejection[] | null;
}

export interface MetricPoint {
  id: string;
  variantId: string;
  capturedAt: Date;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  watchTimeSec: number;
  clicks: number;
  rawJson: Record<string, unknown> | null;
}

export interface ComparisonRow {
  conceptId: string;
  conceptName: string;
  channel: Channel;
  lang: Lang;
  variantId: string;
  ageHours?: number; // common age (hours since publish) the rates were taken at
  engagementRate: number;
  shareRate: number;
  saveRate: number;
  completionProxy: number | null;
  impressions: number;
}

export interface ReportFigure {
  postId?: string;
  metric: string; // per-post metric, or an aggregate key from the facts table
  value: number; // display units (rates in %)
}

export interface ReportClaim {
  id: string;
  statement: string; // inline [P-1234] chips
  postIds: string[];
  metric: string;
  verified: boolean;
  section?: string; // "Summary" or a section title
  figures?: ReportFigure[];
}

export interface Report {
  id: string;
  weekStart: Date;
  weekEnd?: Date;
  claims: ReportClaim[]; // only claims that passed the verifier
  verified: boolean; // false if anything was dropped
  unverifiedReasons?: string[]; // what was dropped and why
  insights?: InsightCard[];
  markdown: string;
  createdAt: Date;
}

export interface InsightCard {
  id: string;
  reportId: string;
  statement: string;
  evidencePostIds: string[];
  lever: Lever;
  recommendation: string;
  active: boolean;
}

export interface AiCallLog {
  id: string;
  provider: string;
  model: string;
  purpose: string;
  inTokens: number;
  outTokens: number;
  costUsd: number;
  ms: number;
  ok: boolean;
  createdAt: Date;
}

export interface ClockState {
  offsetMs: number;
  now: Date;
}

export interface SpendSummary {
  totalUsd: number;
  capUsd: number;
  softCapUsd: number;
  callCount: number;
}
