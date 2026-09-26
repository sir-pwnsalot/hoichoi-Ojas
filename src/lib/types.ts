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
  variantId: string;
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
  engagementRate: number;
  shareRate: number;
  saveRate: number;
  completionProxy: number | null;
  impressions: number;
}

export interface ReportClaim {
  id: string;
  statement: string;
  postIds: string[];
  metric: string;
  verified: boolean;
}

export interface Report {
  id: string;
  weekStart: Date;
  claims: ReportClaim[];
  verified: boolean;
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
