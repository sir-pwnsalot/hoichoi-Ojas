import type { AssetFormat, AssetProbe } from "@/lib/media/probe";
import type { Channel, Rejection, RejectionCode } from "@/lib/types";

export type { Channel, Rejection, RejectionCode, AssetProbe, AssetFormat };

export type AttemptSource = "scheduler" | "rule_breaker";

export interface PublishPayload {
  variantId: string | null; // null for rule-breaker demo payloads
  caption: string; // the FINAL caption text as it would be posted (hashtags included)
  title?: string; // YouTube only
  hashtags: string[]; // informational; limits are counted from `caption`
  asset: { url: string };
  source?: AttemptSource;
}

export type ValidationResult =
  | { ok: true; probe: AssetProbe }
  | { ok: false; rejections: Rejection[]; probe: AssetProbe | null };

export interface PublishResult {
  externalId: string;
  publishedAt: Date;
}

export interface ChannelAdapter {
  channel: Channel;
  validate(p: PublishPayload): Promise<ValidationResult>;
  // Always calls validate() itself first; throws AdapterRejectedError on any violation.
  publish(p: PublishPayload): Promise<PublishResult>;
}

export interface AttemptLog {
  variantId: string | null;
  channel: Channel;
  source: AttemptSource;
  ok: boolean;
  externalId: string | null;
  reasons: Rejection[] | null;
  attemptedAt: Date;
}

export class AdapterRejectedError extends Error {
  constructor(
    public readonly channel: Channel,
    public readonly rejections: Rejection[],
  ) {
    super(`${channel} rejected the post: ${rejections.map((r) => r.code).join(", ")}`);
    this.name = "AdapterRejectedError";
  }
}
