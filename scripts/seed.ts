// Idempotent demo seed: brand kit + 4 weeks of published history (~36 posts)
// with placeholder images and simulator metrics.
//
//   npm run db:seed              # local.db
//   npm run db:seed -- --reset   # drop + recreate the history rows
//   npx tsx --env-file=.env.local scripts/seed.ts   # against Turso
//
// Upserts by fixed ids (brand kit "hoichoi", briefs hist-b-*, concepts hist-*,
// posts P-9001…P-9036), so reruns never duplicate. Publish times are fixed on
// first insert; reruns only add metric snapshots the clock has since passed.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BRAND_KIT, HISTORY } from "./seed-history";
import type { Channel, Lang } from "../src/lib/types";

const CHANNELS: Channel[] = ["instagram", "x", "youtube"];
const LANGS: Lang[] = ["bn", "en"];
const SIZE: Record<Channel, [number, number]> = { instagram: [1080, 1350], x: [1600, 900], youtube: [1080, 1920] };
const LABEL: Record<Channel, string> = { instagram: "Instagram · 4:5", x: "X · 16:9", youtube: "Shorts · 9:16" };
const SHORTS_DURATION = 20;

// Publish day (from 28 days ago) per concept, and IST hour per concept×channel:
// time varies across concepts; bn/en of one concept×channel share an hour
// (en 30 min later) so the bn-vs-en comparison is clean.
const DAYS = [1, 5, 9, 14, 18, 23];
const HOURS = [20, 13, 21, 10, 19, 16];

const postId = (k: number, c: number, l: number) => `P-${9001 + k * 6 + c * 2 + l}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Latin-only text: Bengali is never rendered server-side (CLAUDE.md).
async function placeholder(show: string, channel: Channel, colors: [string, string]): Promise<Buffer> {
  const [w, h] = SIZE[channel];
  const fs = Math.round(Math.min(w, h) * 0.11);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fs}" fill="#fff">${esc(show)}</text>
  <text x="50%" y="${Math.round(h * 0.48 + fs * 0.9)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(fs * 0.35)}" fill="#ffffffcc">${esc(LABEL[channel])}</text>
  <text x="${Math.round(w * 0.05)}" y="${Math.round(h * 0.94)}" font-family="Arial, sans-serif" font-weight="700" font-size="${Math.round(fs * 0.4)}" fill="#fff">hoichoi</text>
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  // Lazy imports so env (DATABASE_URL) is read after --env-file / defaults.
  const { eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { now } = await import("../src/lib/domain/clock");
  const { contentHashOf } = await import("../src/lib/repo");
  const { captureVariant } = await import("../src/lib/analytics/ingest");

  const ids = HISTORY.flatMap((_, k) => CHANNELS.flatMap((_, c) => LANGS.map((_, l) => postId(k, c, l))));

  if (process.argv.includes("--reset")) {
    await db.delete(s.metrics).where(inArray(s.metrics.variantId, ids));
    await db.delete(s.publishAttempts).where(inArray(s.publishAttempts.variantId, ids));
    await db.delete(s.schedules).where(inArray(s.schedules.variantId, ids));
    await db.delete(s.approvals).where(inArray(s.approvals.variantId, ids));
    await db.delete(s.variants).where(inArray(s.variants.id, ids));
    await db.delete(s.concepts).where(inArray(s.concepts.id, HISTORY.map((c) => `hist-${c.key}`)));
    await db.delete(s.briefs).where(inArray(s.briefs.id, HISTORY.map((c) => `hist-b-${c.key}`)));
    console.log("reset: history rows removed");
  }

  // Brand kit
  const { name, colors, fonts, voice, logoUrl, bannedPhrases } = BRAND_KIT;
  await db
    .insert(s.brandKit)
    .values(BRAND_KIT)
    .onConflictDoUpdate({ target: s.brandKit.id, set: { name, colors, fonts, voice, logoUrl, bannedPhrases } });

  const at = await now();
  const IST = 5.5 * 3600_000;
  const day0 = Math.floor((at.getTime() + IST) / 86_400_000) * 86_400_000 - IST - 28 * 86_400_000; // IST midnight, 28d ago

  const outDir = path.join(process.cwd(), "public", "demo", "history");
  mkdirSync(outDir, { recursive: true });

  let created = 0;
  let snapshots = 0;
  for (const [k, concept] of HISTORY.entries()) {
    const briefId = `hist-b-${concept.key}`;
    const conceptId = `hist-${concept.key}`;
    const conceptAt = new Date(day0 + DAYS[k] * 86_400_000 - 2 * 86_400_000);
    await db
      .insert(s.briefs)
      .values({
        id: briefId,
        title: concept.name,
        show: concept.show,
        keyMessage: concept.keyMessage,
        audience: "Bengali OTT viewers, 18–45, Kolkata + diaspora",
        languages: ["bn", "en"],
        tone: "witty, bold",
        ctaGoal: "watch",
        rawText: null,
        briefLang: "bn",
        appliedInsightIds: [],
        createdAt: conceptAt,
      })
      .onConflictDoNothing();
    await db.insert(s.concepts).values({ id: conceptId, briefId, name: concept.name, createdAt: conceptAt }).onConflictDoNothing();

    for (const [c, channel] of CHANNELS.entries()) {
      const file = `${concept.key}-${channel}.png`;
      const filePath = path.join(outDir, file);
      if (!existsSync(filePath)) writeFileSync(filePath, await placeholder(concept.show, channel, concept.colors));
      const buf = readFileSync(filePath);
      const png = await sharp(buf).metadata();
      const bytes = buf.length;
      const sha = createHash("sha256").update(buf).digest("hex");

      for (const [l, lang] of LANGS.entries()) {
        const id = postId(k, c, l);
        const p = concept.posts[channel][lang];
        const hour = HOURS[(k + c) % HOURS.length];
        const publishedAt = new Date(day0 + DAYS[k] * 86_400_000 + hour * 3600_000 + l * 30 * 60_000);

        const existing = await db.select().from(s.variants).where(eq(s.variants.id, id));
        if (!existing.length) {
          const row = {
            id,
            conceptId,
            channel,
            lang,
            format: channel === "youtube" ? "video" : "image",
            caption: p.caption,
            hashtags: p.hashtags,
            cta: p.cta,
            hook: p.hook,
            planJson: {
              channel,
              angle: concept.name,
              hook: p.hook,
              tone: "witty, bold",
              length: channel === "x" ? "short" : "medium",
              ctaType: p.ctaType,
              hashtagStrategy: `${p.hashtags.length} tags`,
              visualComposition: "history placeholder",
              imagePrompt: "",
              appliedInsights: [],
            },
            imagePrompt: `${concept.show} key art, ${LABEL[channel]}`,
            baseImageUrls: [],
            assetUrl: `/demo/history/${file}`,
            assetSha256: sha,
            width: png.width ?? SIZE[channel][0],
            height: png.height ?? SIZE[channel][1],
            bytes,
            durationSec: channel === "youtube" ? SHORTS_DURATION : null,
            criticJson: null,
            status: "published",
            version: 1,
            parentId: null,
            discardNote: null,
            createdAt: new Date(publishedAt.getTime() - 86_400_000),
          };
          await db.insert(s.variants).values(row);
          await db.insert(s.approvals).values({
            id: `hist-appr-${id}`,
            variantId: id,
            approver: "social-lead (history)",
            contentHash: contentHashOf(row),
            approvedAt: new Date(publishedAt.getTime() - 20 * 3600_000),
            revokedAt: null,
          });
          await db.insert(s.schedules).values({
            id: `hist-sched-${id}`,
            variantId: id,
            scheduledFor: publishedAt,
            createdAt: new Date(publishedAt.getTime() - 18 * 3600_000),
          });
          await db.insert(s.publishAttempts).values({
            id: `hist-pub-${id}`,
            variantId: id,
            channel,
            source: "scheduler",
            attemptedAt: publishedAt,
            ok: true,
            externalId: `${{ instagram: "ig_", x: "x_", youtube: "yt_" }[channel]}hist${id.slice(2)}`,
            reasons: null,
          });
          created++;
        }

        const [v] = await db.select().from(s.variants).where(eq(s.variants.id, id));
        const [attempt] = await db.select().from(s.publishAttempts).where(eq(s.publishAttempts.id, `hist-pub-${id}`));
        snapshots += await captureVariant(v, attempt?.attemptedAt ?? publishedAt, at);
      }
    }
  }

  console.log(`seed: brand kit ✓ · ${created} new history posts (${ids.length} total) · ${snapshots} new metric snapshots`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
