"use server";

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { publishAttempts, schedules, variants } from "@/db/schema";
import { runSchedulerTick as tick, schedule } from "@/lib/domain/scheduler";
import { now } from "@/lib/domain/clock";
import { getAdapter, AdapterRejectedError } from "@/lib/adapters";
import { finalCaption } from "@/lib/adapters/payload";
import { activeApproval, loadVariantRow, rowToVariant } from "@/lib/repo";
import { synthImage, synthMp4, synthNoisePng } from "@/lib/media/synth";
import { putObject } from "@/lib/storage";
import type { Channel, PublishAttempt, Rejection, Schedule } from "@/lib/types";

// The approval gate lives in the domain: schedule() throws NotApprovedError /
// ApprovalMismatchError / IllegalTransitionError, and nothing is written.
export async function scheduleVariant(variantId: string, scheduledFor: Date): Promise<Schedule> {
  const row = await loadVariantRow(variantId);
  const variant = rowToVariant(row);
  const { status } = schedule(variant, await activeApproval(variantId));
  const s: Schedule = { id: randomUUID(), variantId, scheduledFor, createdAt: await now() };
  await db.insert(schedules).values(s);
  await db.update(variants).set({ status }).where(eq(variants.id, variantId));
  return s;
}

export interface RunSchedulerTickResult {
  published: string[];
  rejected: string[];
}

// Publishes every due scheduled variant (app clock) through its adapter.
// Call on /queue page load and after "⏩ advance clock".
export async function runSchedulerTick(): Promise<RunSchedulerTickResult> {
  return tick();
}

export type RuleBreakerKind = "oversized_image" | "wrong_ratio_video" | "long_caption" | "custom";

export interface RuleBreakerPayload {
  channel: Channel;
  caption?: string;
  title?: string; // YouTube only
  hashtags?: string[];
  assetUrl?: string; // omitted → a spec-valid synthetic asset for the channel
}

export interface RuleBreakerResult {
  ok: boolean;
  channel: Channel;
  rejections: Rejection[];
  externalId?: string;
}

// Synthetic assets with real bytes (src/lib/media/synth.ts), stored once per process.
const SYNTH: Record<string, () => Promise<Uint8Array> | Uint8Array> = {
  "ig-11mb.png": () => synthNoisePng(1720, 2150, 7), // 4:5, 1720 wide, ~11 MB
  "shorts-1x1.mp4": () => synthMp4(1080, 1080, 10), // square clip
  "ig-valid.png": () => synthImage(1080, 1350),
  "x-valid.png": () => synthImage(1600, 900),
  "yt-valid.mp4": () => synthMp4(1080, 1920, 10),
};
const synthUrls = new Map<string, Promise<string>>();
function synthAsset(name: keyof typeof SYNTH): Promise<string> {
  let url = synthUrls.get(name);
  if (!url) {
    url = Promise.resolve(SYNTH[name]()).then((bytes) =>
      putObject(`rule-breaker/${name}`, bytes, name.endsWith(".mp4") ? "video/mp4" : "image/png"),
    );
    url.catch(() => synthUrls.delete(name));
    synthUrls.set(name, url);
  }
  return url;
}
const VALID_ASSET: Record<Channel, string> = { instagram: "ig-valid.png", x: "x-valid.png", youtube: "yt-valid.mp4" };

const LONG_X_POST = (() => {
  const base =
    "Tonight on hoichoi: the detective finally opens the locked room in north Kolkata, and nothing about the old family is what it seemed. " +
    "Three generations, one secret, and a letter nobody was supposed to read. Episode 5 drops at 9 pm and it changes everything you thought you knew. Stream it now.";
  return (base + " ".repeat(310)).slice(0, 310).replace(/ $/, ".");
})();

// Demo panel: submits a payload that breaks a platform rule to the REAL adapter
// (publish() validates the real bytes itself and logs the attempt). It must be
// rejected with typed reasons, never silently accepted or auto-fixed.
export async function submitRuleBreaker(kind: RuleBreakerKind, payload?: RuleBreakerPayload): Promise<RuleBreakerResult> {
  let channel: Channel;
  let caption: string;
  let title: string | undefined;
  let hashtags: string[] = [];
  let assetUrl: string;

  switch (kind) {
    case "wrong_ratio_video":
      channel = "youtube";
      caption = "Episode 5 in 60 seconds. #Shorts #hoichoi";
      title = "The locked room — Episode 5";
      assetUrl = await synthAsset("shorts-1x1.mp4");
      break;
    case "oversized_image":
      channel = "instagram";
      caption = "আজ রাত ৯টায় নতুন পর্ব। #hoichoi";
      assetUrl = await synthAsset("ig-11mb.png");
      break;
    case "long_caption":
      channel = "x";
      caption = LONG_X_POST;
      assetUrl = await synthAsset("x-valid.png");
      break;
    case "custom": {
      if (!payload) throw new Error("custom rule-breaker needs a payload");
      channel = payload.channel;
      hashtags = payload.hashtags ?? [];
      caption = finalCaption(payload.caption ?? "", hashtags);
      title = payload.title ?? (channel === "youtube" ? "Custom Shorts post" : undefined);
      assetUrl = payload.assetUrl || (await synthAsset(VALID_ASSET[channel]));
      break;
    }
  }

  try {
    const res = await getAdapter(channel).publish({
      variantId: null,
      caption,
      title,
      hashtags,
      asset: { url: assetUrl },
      source: "rule_breaker",
    });
    return { ok: true, channel, rejections: [], externalId: res.externalId };
  } catch (err) {
    if (err instanceof AdapterRejectedError) return { ok: false, channel, rejections: err.rejections };
    throw err;
  }
}

export async function listPublishAttempts(variantId?: string): Promise<PublishAttempt[]> {
  const q = db.select().from(publishAttempts);
  const rows = await (variantId ? q.where(eq(publishAttempts.variantId, variantId)) : q)
    .orderBy(desc(publishAttempts.attemptedAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    channel: r.channel as Channel,
    source: r.source as PublishAttempt["source"],
    attemptedAt: r.attemptedAt,
    ok: r.ok,
    externalId: r.externalId,
    reasons: (r.reasons as Rejection[] | null) ?? null,
  }));
}
