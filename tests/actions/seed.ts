import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { briefs, concepts, variants } from "@/db/schema";
import { putObject } from "@/lib/storage";
import type { Channel, Lang, VariantStatus } from "@/lib/types";
import { fixture } from "../fixtures/load";

let n = 0;
const ASSET: Record<Channel, string> = { instagram: "ig-valid.png", x: "x-valid.png", youtube: "yt-valid.mp4" };

// Inserts brief → concept → one variant with a real stored asset. Returns the variant id.
export async function seedVariant(
  opts: {
    channel?: Channel;
    lang?: Lang;
    status?: VariantStatus;
    asset?: string | null; // fixture name; null = no composed asset
    caption?: string;
  } = {},
): Promise<string> {
  const channel = opts.channel ?? "instagram";
  const briefId = randomUUID();
  const conceptId = randomUUID();
  const id = `T-${Date.now().toString(36)}-${++n}`;
  await db.insert(briefs).values({
    id: briefId,
    title: "Ep 5",
    show: "Mandaar",
    keyMessage: "New episode tonight",
    audience: "18-34 Kolkata",
    languages: ["bn", "en"],
    tone: "dramatic",
    ctaGoal: "watch",
    rawText: null,
    briefLang: "en",
    appliedInsightIds: [],
    createdAt: new Date(),
  });
  await db.insert(concepts).values({ id: conceptId, briefId, name: "Launch", createdAt: new Date() });
  const assetName = opts.asset === undefined ? ASSET[channel] : opts.asset;
  const url = assetName
    ? await putObject(`test/${id}-${assetName}`, fixture(assetName), "application/octet-stream")
    : null;
  await db.insert(variants).values({
    id,
    conceptId,
    channel,
    lang: opts.lang ?? "en",
    format: channel === "youtube" ? "video" : "image",
    caption: opts.caption ?? "Tonight, the truth comes out.",
    hashtags: ["#hoichoi"],
    cta: "Watch now",
    hook: "Episode 5",
    planJson: {
      channel,
      angle: "a",
      hook: "h",
      tone: "t",
      length: "l",
      ctaType: "c",
      hashtagStrategy: "s",
      visualComposition: "v",
      imagePrompt: "moody kolkata street at night",
      appliedInsights: [],
    },
    imagePrompt: "moody kolkata street at night",
    baseImageUrls: ["/uploads/base.png"],
    assetUrl: url,
    assetSha256: url ? `sha-${id}` : null,
    status: opts.status ?? "draft",
    version: 1,
    createdAt: new Date(),
  });
  return id;
}
