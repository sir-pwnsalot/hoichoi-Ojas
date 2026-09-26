import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/db";
import { publishAttempts } from "@/db/schema";
import { now as appNow } from "@/lib/domain/clock";
import { loadAssetBytes, validateAgainstSpec } from "./validate";
import { AdapterRejectedError, type AttemptLog, type Channel, type ChannelAdapter, type PublishPayload } from "./types";

export interface AdapterDeps {
  loadBytes(url: string): Promise<Uint8Array | null>;
  logAttempt(a: AttemptLog): Promise<void>;
  now(): Promise<Date>;
}

const PREFIX: Record<Channel, string> = { instagram: "ig_", x: "x_", youtube: "yt_" };

export async function logAttemptToDb(a: AttemptLog): Promise<void> {
  await db.insert(publishAttempts).values({ id: randomUUID(), ...a });
}

const defaultDeps: AdapterDeps = { loadBytes: loadAssetBytes, logAttempt: logAttemptToDb, now: appNow };

// Mock channel adapter. validate() inspects the real bytes + caption;
// publish() ALWAYS re-runs validate() itself and logs every attempt.
export function createAdapter(channel: Channel, deps: Partial<AdapterDeps> = {}): ChannelAdapter {
  const d = { ...defaultDeps, ...deps };

  async function validate(p: PublishPayload) {
    const bytes = await d.loadBytes(p.asset.url);
    return validateAgainstSpec(channel, p, bytes);
  }

  async function publish(p: PublishPayload) {
    const result = await validate(p);
    const attemptedAt = await d.now();
    const base = { variantId: p.variantId, channel, source: p.source ?? "scheduler", attemptedAt } as const;
    if (!result.ok) {
      await d.logAttempt({ ...base, ok: false, externalId: null, reasons: result.rejections });
      throw new AdapterRejectedError(channel, result.rejections);
    }
    const externalId = PREFIX[channel] + randomBytes(6).toString("base64url");
    await d.logAttempt({ ...base, ok: true, externalId, reasons: null });
    // TODO(M5): kick off the metrics simulator schedule for this post (demo-seed).
    return { externalId, publishedAt: attemptedAt };
  }

  return { channel, validate, publish };
}
