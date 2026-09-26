import { createHash } from "node:crypto";
import sharp from "sharp";
import { assertBudget, logAiCall } from "@/lib/ai/llm";
import { getObject, putObject, StorageConfigError } from "@/lib/storage";
import type { Channel } from "@/lib/types";

// Every image-model call in the app goes through generateImage(). Chain:
// Cloudflare Workers AI (CF_IMAGE_MODEL) → Pollinations → Gemini (paid; only if GEMINI_IMAGE_MODEL
// is set). Images are generated at each channel's NATIVE aspect — never one
// master cropped per channel (non-negotiable #1). See skill `ai-providers`.

export type ImageProvider = "cloudflare" | "pollinations" | "gemini";

// Final publish sizes (the browser composer outputs exactly these).
export const NATIVE_SIZE: Record<Channel, { width: number; height: number; aspect: string }> = {
  instagram: { width: 1080, height: 1350, aspect: "4:5" },
  x: { width: 1600, height: 900, aspect: "16:9" },
  youtube: { width: 1080, height: 1920, aspect: "9:16" },
};

// Generation sizes: same aspect as NATIVE_SIZE, multiples of 16 so every
// provider accepts them. Upscaling to the native size at the same aspect is
// fine; cropping a different-aspect master is not.
export const GENERATION_SIZE: Record<Channel, { width: number; height: number }> = {
  instagram: { width: 1024, height: 1280 },
  x: { width: 1536, height: 864 },
  youtube: { width: 864, height: 1536 },
};

export const NO_TEXT_SUFFIX = "no text, no letters, no watermark";

export function stripNoText(prompt: string): string {
  return prompt
    .trim()
    .replace(/[,.\s]*no text,?\s*no letters,?\s*no watermark\.?$/i, "")
    .trim();
}

export function withNoText(prompt: string): string {
  return `${stripNoText(prompt)}, ${NO_TEXT_SUFFIX}`;
}

export interface GenerateImageArgs {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  mime: string;
  provider: ImageProvider;
  seed: number;
  width: number; // actual, measured from the bytes
  height: number;
  url: string; // stored copy (Blob / public/uploads)
  cached: boolean;
}

// rate_limited: free-tier quota / HTTP 429; a later call will likely work.
// config: our env is wrong (square-only model, missing keys); retrying won't help.
// failed: anything else (HTTP 5xx, content filter, bad bytes, timeouts).
export type ImageFailureKind = "rate_limited" | "config" | "failed";

export interface ImageFailure {
  provider: ImageProvider;
  kind: ImageFailureKind;
  error: string;
}

export class ImageProviderError extends Error {
  constructor(
    public readonly kind: ImageFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "ImageProviderError";
  }
}

async function httpError(res: Response): Promise<ImageProviderError> {
  const detail = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
  return res.status === 429
    ? new ImageProviderError("rate_limited", `rate limited, will retry next call (${detail})`)
    : new ImageProviderError("failed", detail);
}

export function describeFailure(f: ImageFailure): string {
  const label = f.kind === "rate_limited" ? "RATE LIMITED" : f.kind === "config" ? "CONFIG ERROR" : "FAILED";
  return `${f.provider} [${label}]: ${f.error}`;
}

export class ImageGenerationError extends Error {
  constructor(public readonly failures: ImageFailure[]) {
    super(`All image providers failed: ${failures.map(describeFailure).join(" | ")}`);
    this.name = "ImageGenerationError";
  }

  // True when every provider was only throttled: a later call should succeed.
  get onlyRateLimited(): boolean {
    return this.failures.length > 0 && this.failures.every((f) => f.kind === "rate_limited");
  }
}

export function imageCacheKey(prompt: string, width: number, height: number, seed: number): string {
  return createHash("sha256").update(`${prompt}\u0000${width}\u0000${height}\u0000${seed}`).digest("hex");
}

function defaultSeed(prompt: string, width: number, height: number): number {
  // Deterministic so a re-run of the same prompt hits the cache.
  return parseInt(createHash("sha256").update(`${prompt}|${width}|${height}`).digest("hex").slice(0, 8), 16) % 1_000_000;
}

function providerOrder(): ImageProvider[] {
  const raw = (process.env.IMAGE_PROVIDER_ORDER || "cloudflare,pollinations,gemini").split(",");
  const known = new Set<ImageProvider>(["cloudflare", "pollinations", "gemini"]);
  return raw
    .map((s) => s.trim() as ImageProvider)
    .filter((p) => known.has(p))
    .filter((p) => p !== "gemini" || Boolean(process.env.GEMINI_IMAGE_MODEL));
}

const IMAGE_TIMEOUT_MS = 90_000;

// Per-provider concurrency caps: Pollinations queues max 1 request per IP
// (429 beyond that); Workers AI times out when flooded.
const CONCURRENCY: Record<ImageProvider, number> = { cloudflare: 2, pollinations: 1, gemini: 2 };
const active: Record<ImageProvider, number> = { cloudflare: 0, pollinations: 0, gemini: 0 };
const waiting: Record<ImageProvider, (() => void)[]> = { cloudflare: [], pollinations: [], gemini: [] };

async function withSlot<T>(provider: ImageProvider, fn: () => Promise<T>): Promise<T> {
  if (active[provider] >= CONCURRENCY[provider]) {
    await new Promise<void>((resolve) => waiting[provider].push(resolve));
  }
  active[provider]++;
  try {
    return await fn();
  } finally {
    active[provider]--;
    waiting[provider].shift()?.();
  }
}

interface RawImage {
  bytes: Uint8Array;
  model: string;
  costUsd: number;
}

// What a Workers AI text-to-image model accepts, from the account's
// /ai/models/schema (checked 2026-09-26). Square-only models ignore
// width/height and can never give a native channel aspect (non-negotiable #1).
export interface CfModelSpec {
  input: "json" | "multipart";
  squareOnly: boolean;
  min: number;
  max: number;
  multiple: number;
  steps: number;
}

// Fastest first (measured: dreamshaper ~4 s at 1024x1280 and 864x1536).
export const RECOMMENDED_CF_IMAGE_MODELS = [
  "@cf/lykon/dreamshaper-8-lcm",
  "@cf/bytedance/stable-diffusion-xl-lightning",
  "@cf/stabilityai/stable-diffusion-xl-base-1.0",
] as const;

export function cfModelSpec(model: string): CfModelSpec {
  if (model.includes("flux-1-schnell")) return { input: "json", squareOnly: true, min: 1024, max: 1024, multiple: 1, steps: 4 };
  if (model.includes("flux-2")) return { input: "multipart", squareOnly: false, min: 256, max: 2048, multiple: 16, steps: 4 };
  if (model.includes("dreamshaper-8-lcm")) return { input: "json", squareOnly: false, min: 256, max: 2048, multiple: 8, steps: 6 };
  if (model.includes("stable-diffusion-xl-lightning")) return { input: "json", squareOnly: false, min: 256, max: 2048, multiple: 8, steps: 4 };
  if (model.includes("stable-diffusion-xl-base")) return { input: "json", squareOnly: false, min: 256, max: 2048, multiple: 8, steps: 20 };
  // Other JSON models (phoenix, lucid-origin, ...): conservative SD limits.
  return { input: "json", squareOnly: false, min: 256, max: 2048, multiple: 8, steps: 8 };
}

// Scales width/height into the model's [min, max] box at the SAME aspect and
// rounds to its multiple. Throws a config error if that can't hold the aspect
// within 1% (never crops). The composer resizes to the exact native size.
export function fitToModel(width: number, height: number, spec: CfModelSpec): { width: number; height: number } {
  if (spec.squareOnly && width !== height) {
    throw new ImageProviderError("config", `model only outputs 1:1, cannot make ${width}x${height}`);
  }
  let scale = Math.min(1, spec.max / Math.max(width, height));
  scale = Math.max(scale, spec.min / Math.min(width, height));
  const round = (n: number) => Math.max(spec.multiple, Math.round((n * scale) / spec.multiple) * spec.multiple);
  const fitted = { width: round(width), height: round(height) };
  const inRange = [fitted.width, fitted.height].every((n) => n >= spec.min && n <= spec.max);
  if (!inRange || !aspectMatches(fitted.width, fitted.height, width, height)) {
    throw new ImageProviderError(
      "config",
      `cannot fit ${width}x${height} into ${spec.min}-${spec.max}px (multiple of ${spec.multiple}) at the same aspect`,
    );
  }
  return fitted;
}

async function callCloudflare(prompt: string, width: number, height: number, seed: number): Promise<RawImage> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CF_IMAGE_MODEL;
  if (!account || !token || !model) {
    throw new ImageProviderError("config", "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CF_IMAGE_MODEL not set");
  }
  const spec = cfModelSpec(model);
  if (spec.squareOnly) {
    throw new ImageProviderError(
      "config",
      `CF_IMAGE_MODEL=${model} ignores width/height and only outputs 1:1, so it can't make native channel aspects. ` +
        `Set CF_IMAGE_MODEL to a model that accepts width/height, e.g. ${RECOMMENDED_CF_IMAGE_MODELS[0]}`,
    );
  }
  const size = fitToModel(width, height, spec);
  let body: BodyInit;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (spec.input === "multipart") {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", String(size.width));
    form.append("height", String(size.height));
    form.append("seed", String(seed));
    form.append("steps", String(spec.steps));
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ prompt, width: size.width, height: size.height, seed, num_steps: spec.steps });
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError(res);
  // Stable Diffusion models return raw image bytes; Flux 2 returns JSON base64.
  if (res.headers.get("content-type")?.startsWith("image/")) {
    return { bytes: new Uint8Array(await res.arrayBuffer()), model, costUsd: 0 };
  }
  const json = (await res.json()) as { result?: { image?: string } };
  const b64 = json.result?.image;
  if (!b64) throw new Error("no image in response");
  return { bytes: new Uint8Array(Buffer.from(b64, "base64")), model, costUsd: 0 };
}

async function callPollinations(prompt: string, width: number, height: number, seed: number): Promise<RawImage> {
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: "true",
    model: "flux",
  });
  const res = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`, {
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError(res);
  if (!res.headers.get("content-type")?.startsWith("image/")) throw new Error("non-image response");
  return { bytes: new Uint8Array(await res.arrayBuffer()), model: "pollinations/flux", costUsd: 0 };
}

function geminiAspect(width: number, height: number): string {
  const r = width / height;
  const options: [string, number][] = [
    ["4:5", 0.8],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["1:1", 1],
  ];
  return options.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
}

async function callGemini(prompt: string, width: number, height: number): Promise<RawImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL;
  if (!apiKey || !model) throw new ImageProviderError("config", "GEMINI_API_KEY / GEMINI_IMAGE_MODEL not set");
  const costUsd = Number(process.env.GEMINI_IMAGE_PRICE_USD ?? "0.04");
  await assertBudget(costUsd);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: geminiAspect(width, height) },
      },
    }),
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError(res);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  };
  const b64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!b64) throw new Error("no image in response");
  return { bytes: new Uint8Array(Buffer.from(b64, "base64")), model, costUsd };
}

async function callImageProvider(p: ImageProvider, prompt: string, w: number, h: number, seed: number): Promise<RawImage> {
  return withSlot(p, () => callImageProviderNow(p, prompt, w, h, seed));
}

async function callImageProviderNow(p: ImageProvider, prompt: string, w: number, h: number, seed: number): Promise<RawImage> {
  switch (p) {
    case "cloudflare":
      return callCloudflare(prompt, w, h, seed);
    case "pollinations":
      return callPollinations(prompt, w, h, seed);
    case "gemini":
      return callGemini(prompt, w, h);
  }
}

// Aspect must match the requested one within 1% — a provider that ignores
// width/height (e.g. a fixed 1:1 model) is treated as a failure, never
// cropped into shape.
export function aspectMatches(w: number, h: number, targetW: number, targetH: number): boolean {
  return Math.abs(w / h - targetW / targetH) / (targetW / targetH) <= 0.01;
}

interface CacheEntry {
  url: string;
  mime: string;
  provider: ImageProvider;
  seed: number;
  width: number;
  height: number;
}

export async function generateImage(args: GenerateImageArgs): Promise<GeneratedImage> {
  const prompt = withNoText(args.prompt);
  const { width, height } = args;
  const seed = args.seed ?? defaultSeed(prompt, width, height);
  const key = imageCacheKey(prompt, width, height, seed);

  const cached = await getObject(`gen/${key}.json`);
  if (cached) {
    const entry = JSON.parse(Buffer.from(cached.bytes).toString("utf8")) as CacheEntry;
    const img = await getObject(entry.url);
    if (img) return { ...entry, bytes: img.bytes, cached: true };
  }

  const failures: ImageFailure[] = [];
  for (const provider of providerOrder()) {
    const started = Date.now();
    try {
      const raw = await callImageProvider(provider, prompt, width, height, seed);
      const meta = await sharp(raw.bytes).metadata();
      if (!meta.width || !meta.height || !meta.format) throw new Error("undecodable image bytes");
      if (!aspectMatches(meta.width, meta.height, width, height)) {
        throw new Error(`wrong aspect ${meta.width}x${meta.height}, wanted ${width}x${height}`);
      }
      const ext = meta.format === "jpeg" ? "jpg" : meta.format;
      const mime = `image/${meta.format}`;
      const url = await putObject(`gen/${key}.${ext}`, raw.bytes, mime);
      const entry: CacheEntry = { url, mime, provider, seed, width: meta.width, height: meta.height };
      await putObject(`gen/${key}.json`, new TextEncoder().encode(JSON.stringify(entry)), "application/json");
      await logAiCall({
        provider,
        model: raw.model,
        purpose: "image",
        inTokens: 0,
        outTokens: 0,
        costUsd: raw.costUsd,
        ms: Date.now() - started,
        ok: true,
      });
      return { ...entry, bytes: raw.bytes, cached: false };
    } catch (err) {
      // Storage misconfiguration isn't the provider's fault and every other
      // provider would hit it too, so surface it as-is.
      if (err instanceof StorageConfigError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const kind: ImageFailureKind = err instanceof ImageProviderError ? err.kind : "failed";
      const failure: ImageFailure = { provider, kind, error: msg };
      failures.push(failure);
      // Config errors always log, so a bad env never falls through silently.
      if (kind === "config" || process.env.LLM_DEBUG) console.error(`[image] ${describeFailure(failure)}`);
      await logAiCall({
        provider,
        model: "unknown",
        purpose: "image",
        inTokens: 0,
        outTokens: 0,
        costUsd: 0,
        ms: Date.now() - started,
        ok: false,
      });
    }
  }
  throw new ImageGenerationError(failures);
}
