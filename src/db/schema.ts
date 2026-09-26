import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

export const briefs = sqliteTable("briefs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  show: text("show").notNull(),
  keyMessage: text("key_message").notNull(),
  audience: text("audience").notNull(),
  languages: text("languages", { mode: "json" }).$type<string[]>().notNull(),
  tone: text("tone").notNull(),
  ctaGoal: text("cta_goal").notNull(),
  rawText: text("raw_text"),
  briefLang: text("brief_lang").notNull(),
  appliedInsightIds: text("applied_insight_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const concepts = sqliteTable("concepts", {
  id: text("id").primaryKey(),
  briefId: text("brief_id")
    .notNull()
    .references(() => briefs.id),
  name: text("name").notNull(),
  // dHash cross-channel similarity report (lib/ai/tailoring.ts)
  similarityJson: text("similarity_json", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const variants = sqliteTable("variants", {
  id: text("id").primaryKey(), // public postId, e.g. "P-0001"
  conceptId: text("concept_id")
    .notNull()
    .references(() => concepts.id),
  channel: text("channel").notNull(), // "instagram" | "x" | "youtube"
  lang: text("lang").notNull(), // "bn" | "en"
  format: text("format").notNull(), // "image" | "video"
  caption: text("caption").notNull(),
  hashtags: text("hashtags", { mode: "json" }).$type<string[]>().notNull(),
  cta: text("cta").notNull(),
  hook: text("hook").notNull(),
  planJson: text("plan_json", { mode: "json" }).$type<Record<string, unknown>>(),
  imagePrompt: text("image_prompt").notNull(),
  // Generated (text-free) base images at native aspect; Shorts has 2–3 frames.
  baseImageUrls: text("base_image_urls", { mode: "json" }).$type<string[]>().notNull().default([]),
  imageProvider: text("image_provider"),
  imageSeed: integer("image_seed"),
  // 64-bit dHash (hex) of the current visual: composed image if uploaded, else base frame 0
  dhash: text("dhash"),
  assetUrl: text("asset_url"),
  assetSha256: text("asset_sha256"),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes"),
  durationSec: real("duration_sec"),
  criticJson: text("critic_json", { mode: "json" }).$type<Record<string, unknown>>(),
  status: text("status").notNull(), // VariantStatus
  version: integer("version").notNull().default(1),
  parentId: text("parent_id"),
  discardNote: text("discard_note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => variants.id),
  approver: text("approver").notNull(),
  contentHash: text("content_hash").notNull(),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => variants.id),
  scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const publishAttempts = sqliteTable("publish_attempts", {
  id: text("id").primaryKey(),
  // null for rule-breaker demo payloads (not a stored variant)
  variantId: text("variant_id").references(() => variants.id),
  channel: text("channel").notNull().default(""),
  source: text("source").notNull().default("scheduler"), // "scheduler" | "rule_breaker"
  attemptedAt: integer("attempted_at", { mode: "timestamp_ms" }).notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  externalId: text("external_id"),
  reasons: text("reasons", { mode: "json" }).$type<unknown[]>(),
});

export const metrics = sqliteTable("metrics", {
  id: text("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => variants.id),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
  // hours since publish at this capture point (1, 6, 24, 72, 168) — the like-for-like key
  ageHours: integer("age_hours"),
  impressions: integer("impressions").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  views: integer("views").notNull().default(0),
  watchTimeSec: real("watch_time_sec").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  rawJson: text("raw_json", { mode: "json" }).$type<Record<string, unknown>>(),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  weekStart: integer("week_start", { mode: "timestamp_ms" }).notNull(),
  claimsJson: text("claims_json", { mode: "json" }).$type<unknown[]>().notNull(),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  // why claims/insights were dropped by lib/report/verify.ts (empty when verified)
  unverifiedReasons: text("unverified_reasons", { mode: "json" }).$type<string[]>().notNull().default([]),
  markdown: text("markdown").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const insights = sqliteTable("insights", {
  id: text("id").primaryKey(),
  reportId: text("report_id")
    .notNull()
    .references(() => reports.id),
  statement: text("statement").notNull(),
  evidencePostIds: text("evidence_post_ids", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  lever: text("lever").notNull(), // "lang" | "channel" | "cta" | "time" | "format" | "hook"
  recommendation: text("recommendation").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const aiCalls = sqliteTable("ai_calls", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  purpose: text("purpose").notNull(),
  inTokens: integer("in_tokens").notNull().default(0),
  outTokens: integer("out_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  ms: integer("ms").notNull().default(0),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const brandKit = sqliteTable("brand_kit", {
  id: text("id").primaryKey(), // "hoichoi"
  name: text("name").notNull(),
  colors: text("colors", { mode: "json" }).$type<Record<string, string>>().notNull(),
  fonts: text("fonts", { mode: "json" }).$type<Record<string, string>>().notNull(),
  voice: text("voice").notNull(),
  logoUrl: text("logo_url"),
  bannedPhrases: text("banned_phrases", { mode: "json" }).$type<string[]>().notNull().default([]),
});

export const appClock = sqliteTable("app_clock", {
  id: integer("id").primaryKey(), // always 1
  offsetMs: integer("offset_ms").notNull().default(0),
});
