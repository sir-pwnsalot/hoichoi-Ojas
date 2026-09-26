import { createHash } from "node:crypto";
import sharp from "sharp";
import { assertBudget, logAiCall } from "@/lib/ai/llm";
import { getObject, putObject } from "@/lib/storage";
import type { Channel } from "@/lib/types";

// Every image-model call in the app goes through generateImage(). Chain:
// Cloudflare Flux → Pollinations → Gemini (paid; only if GEMINI_IMAGE_MODEL
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

export class ImageGenerationError extends Error {
  constructor(public readonly failures: { provider: ImageProvider; error: string }[]) {
    super(`All image providers failed: ${failures.map((f) => `${f.provider}: ${f.error}`).join(" | ")}`);
    this.name = "ImageGenerationError";
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

// Flux 2 models on Workers AI take multipart form input with width/height;
// other text-to-image models take JSON. flux-1-schnell only makes fixed
// 1024x1024 images (it rejects width/height), so it can't produce native
// aspects — fail fast instead of cropping.
async function callCloudflare(prompt: string, width: number, height: number, seed: number): Promise<RawImage> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CF_IMAGE_MODEL;
  if (!account || !token || !model) throw new Error("Cloudflare image env not set");
  if (model.includes("flux-1-schnell")) {
    throw new Error(`${model} only outputs 1:1 — set CF_IMAGE_MODEL to a Flux 2 model for native aspects`);
  }
  let body: BodyInit;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (model.includes("flux-2")) {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("seed", String(seed));
    form.append("steps", "4");
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ prompt, width, height, seed, num_steps: 6 });
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
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
  if (!apiKey || !model) throw new Error("Gemini image env not set");
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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
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

  const failures: { provider: ImageProvider; error: string }[] = [];
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
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ provider, error: msg });
      if (process.env.LLM_DEBUG) console.error(`[image debug] ${provider} failed:`, msg);
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
