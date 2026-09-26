import { readFile } from "node:fs/promises";
import path from "node:path";
import twitter from "twitter-text";
import { probeAsset, type AssetProbe } from "@/lib/media/probe";
import { getObject } from "@/lib/storage";
import { ASPECT_TOLERANCE, SPECS, type ChannelSpec } from "./specs";
import type { Channel, PublishPayload, Rejection, ValidationResult } from "./types";

// Validation reads the ACTUAL bytes and the ACTUAL caption text. It never
// trusts a DB field, a filename or a content-type, and never fixes anything:
// every violation becomes a typed Rejection, and all of them are returned.

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function countGraphemes(text: string): number {
  return [...segmenter.segment(text)].length;
}

// X: twitter-text weighted length (emoji 2, URLs 23). Others: grapheme
// clusters — `.length` over-counts Bengali conjuncts and combining marks.
export function captionLength(spec: ChannelSpec, text: string): number {
  return spec.caption.counting === "twitter-weighted"
    ? twitter.parseTweet(text).weightedLength
    : countGraphemes(text);
}

// Hashtags counted from the final caption text (Bengali tags include combining marks).
const HASHTAG_RE = /(^|[^\p{L}\p{M}\p{N}_&])[#＃][\p{L}\p{M}\p{N}_]+/gu;
export function countHashtags(text: string): number {
  return [...text.matchAll(HASHTAG_RE)].length;
}

const fmtMB = (b: number) => `${(b / (1024 * 1024)).toFixed(1)} MB`;
const ratioLabel = (w: number, h: number) => `${w}×${h} (${(w / h).toFixed(3)})`;

function aspectOk(spec: ChannelSpec, w: number, h: number): boolean {
  const r = w / h;
  const a = spec.aspect;
  if ("targets" in a) return a.targets.some((t) => Math.abs(r - t) / t <= ASPECT_TOLERANCE);
  return r >= a.min * (1 - ASPECT_TOLERANCE) && r <= a.max * (1 + ASPECT_TOLERANCE);
}

function assetRejections(spec: ChannelSpec, bytes: Uint8Array | null, probe: AssetProbe | null, probeError: string | null): Rejection[] {
  const out: Rejection[] = [];
  const formats = spec.formats.map((f) => f.toUpperCase()).join(", ");
  if (!bytes) {
    return [{ code: "FORMAT", field: "asset", limit: formats, actual: "no asset / unreadable", message: `${spec.label}: the asset could not be fetched.` }];
  }
  // Size is always measurable from the bytes, even if the format is unknown.
  if (bytes.byteLength > spec.maxBytes) {
    out.push({
      code: "FILE_TOO_LARGE",
      field: "asset",
      limit: fmtMB(spec.maxBytes),
      actual: fmtMB(bytes.byteLength),
      message: `${spec.label} files must be ${fmtMB(spec.maxBytes)} or smaller; this one is ${fmtMB(bytes.byteLength)} (${bytes.byteLength} bytes).`,
    });
  }
  if (!probe) {
    out.push({ code: "FORMAT", field: "asset", limit: formats, actual: probeError ?? "unknown", message: `${spec.label} accepts ${formats}; the bytes are not a readable ${formats} file.` });
    return out;
  }
  if (!spec.formats.includes(probe.format)) {
    out.push({ code: "FORMAT", field: "asset", limit: formats, actual: probe.format.toUpperCase(), message: `${spec.label} accepts ${formats}; got ${probe.format.toUpperCase()}.` });
  }
  const { width: w, height: h } = probe;
  if (w && h) {
    if (!aspectOk(spec, w, h)) {
      out.push({ code: "ASPECT_RATIO", field: "asset", limit: spec.aspect.label, actual: ratioLabel(w, h), message: `${spec.label} needs ${spec.aspect.label} (±1%); got ${ratioLabel(w, h)}.` });
    }
    if (w < spec.minWidth || h < spec.minHeight) {
      const limit = spec.minHeight ? `${spec.minWidth}×${spec.minHeight} min` : `${spec.minWidth} wide min`;
      out.push({ code: "DIMENSIONS", field: "asset", limit, actual: `${w}×${h}`, message: `${spec.label} needs at least ${limit}; got ${w}×${h}.` });
    }
  }
  if (spec.duration && probe.format === "mp4") {
    const d = probe.durationSec ?? 0;
    if (d < spec.duration.minSec || d > spec.duration.maxSec) {
      out.push({
        code: "DURATION",
        field: "asset",
        limit: `${spec.duration.minSec}–${spec.duration.maxSec} s`,
        actual: `${d.toFixed(1)} s`,
        message: `${spec.label} clips must be ${spec.duration.minSec}–${spec.duration.maxSec} s; this one is ${d.toFixed(1)} s.`,
      });
    }
  }
  return out;
}

function textRejections(spec: ChannelSpec, p: PublishPayload): Rejection[] {
  const out: Rejection[] = [];
  const field = spec.caption.field;
  if (!p.caption.trim()) {
    out.push({ code: "EMPTY_CAPTION", field, limit: "non-empty", actual: 0, message: `${spec.label}: the ${field} is empty.` });
  } else {
    const len = captionLength(spec, p.caption);
    if (len > spec.caption.max) {
      const unit = spec.caption.counting === "twitter-weighted" ? "weighted characters" : "characters (grapheme clusters)";
      out.push({ code: "CAPTION_TOO_LONG", field, limit: spec.caption.max, actual: len, message: `${spec.label} ${field} is ${len} ${unit}; the limit is ${spec.caption.max}.` });
    }
  }
  if (spec.title) {
    const title = p.title ?? "";
    if (!title.trim()) {
      out.push({ code: "EMPTY_CAPTION", field: "title", limit: "non-empty", actual: 0, message: `${spec.label}: the title is empty.` });
    } else {
      const len = countGraphemes(title);
      if (len > spec.title.max) {
        out.push({ code: "TITLE_TOO_LONG", field: "title", limit: spec.title.max, actual: len, message: `${spec.label} title is ${len} characters; the limit is ${spec.title.max}.` });
      }
    }
  }
  const tags = countHashtags(p.caption);
  if (tags > spec.maxHashtags) {
    out.push({ code: "TOO_MANY_HASHTAGS", field, limit: spec.maxHashtags, actual: tags, message: `${spec.label} allows ${spec.maxHashtags} hashtags; the ${field} has ${tags}.` });
  }
  return out;
}

// Pure: validates a payload against a channel spec given the asset bytes.
export async function validateAgainstSpec(channel: Channel, p: PublishPayload, bytes: Uint8Array | null): Promise<ValidationResult> {
  const spec = SPECS[channel];
  let probe: AssetProbe | null = null;
  let probeError: string | null = null;
  if (bytes) {
    try {
      probe = await probeAsset(bytes);
    } catch (err) {
      probeError = err instanceof Error ? err.message : String(err);
    }
  }
  const rejections = [...assetRejections(spec, bytes, probe, probeError), ...textRejections(spec, p)];
  if (rejections.length === 0 && probe) return { ok: true, probe };
  return { ok: false, rejections, probe };
}

// Fetches the real bytes behind an asset URL: storage (/uploads or Blob),
// files under public/, or any http(s) URL. Returns null if unreachable.
export async function loadAssetBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith("/uploads/") || (/^https?:\/\//.test(url) && url.includes(".blob.vercel-storage.com"))) {
      return (await getObject(url))?.bytes ?? null;
    }
    if (url.startsWith("/")) {
      const publicDir = path.join(process.cwd(), "public");
      const file = path.join(publicDir, path.posix.normalize(url));
      if (!file.startsWith(publicDir)) return null;
      return new Uint8Array(await readFile(file));
    }
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    }
    return null;
  } catch {
    return null;
  }
}
