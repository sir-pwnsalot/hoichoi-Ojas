import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { db } from "@/db";
import { aiCalls } from "@/db/schema";
import type { SpendSummary } from "@/lib/types";
import { estimateCostUsd } from "@/lib/ai/pricing";

// Every AI call in this app goes through generateJSON() — never call a
// provider SDK directly from a route or action. See skill `ai-providers`.

export type LlmPurpose = "copy" | "critic" | "plan" | "report" | "insight_extraction";
// Ledger purposes also include non-LLM AI calls (image.ts).
export type AiCallPurpose = LlmPurpose | "image";

export interface GenerateJSONArgs<T> {
  purpose: LlmPurpose;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
}

export class BudgetExceededError extends Error {
  constructor(
    public readonly spentUsd: number,
    public readonly capUsd: number,
  ) {
    super(`AI budget exceeded: $${spentUsd.toFixed(2)} spent of $${capUsd.toFixed(2)} cap`);
    this.name = "BudgetExceededError";
  }
}

// Thrown by generateJSON() when every provider in the purpose's chain failed
// (rate limits, outages, timeouts or repeated schema mismatches). Actions
// catch it and return a normal error result rather than crashing into a 500.
export class AllProvidersExhaustedError extends Error {
  constructor(
    public readonly purpose: LlmPurpose,
    public readonly attempts: { provider: string; reason: string }[],
  ) {
    super(
      "All AI providers are currently rate-limited or unavailable — try again in a few minutes, or switch LLM_TIER to premium.",
    );
    this.name = "AllProvidersExhaustedError";
  }
}

type ProviderName = "gemini" | "groq" | "openrouter_free" | "openrouter_premium";

interface ProviderCallResult {
  provider: ProviderName;
  model: string;
  raw: string;
  inTokens: number;
  outTokens: number;
  costUsd: number;
}

// Purpose -> provider fallback chain (see ai-providers skill's routing table).
// Groq is fast but has weak Bengali, so it's never used for copy/critic.
function providerChainFor(purpose: LlmPurpose): ProviderName[] {
  const premium = process.env.LLM_TIER === "premium";
  switch (purpose) {
    case "plan":
    case "insight_extraction":
      return premium ? ["groq", "gemini", "openrouter_premium"] : ["groq", "gemini", "openrouter_free"];
    case "report":
      // English-only analytics JSON, so Groq is a fine fallback here.
      return premium ? ["gemini", "groq", "openrouter_premium"] : ["gemini", "groq", "openrouter_free"];
    default:
      return premium ? ["gemini", "openrouter_premium"] : ["gemini", "openrouter_free"];
  }
}

async function getTotalSpendUsd(): Promise<number> {
  const rows = await db.select({ costUsd: aiCalls.costUsd }).from(aiCalls);
  return rows.reduce((sum, row) => sum + row.costUsd, 0);
}

export async function assertBudget(estimateUsd: number): Promise<void> {
  const cap = Number(process.env.BUDGET_USD_CAP ?? "20");
  const spent = await getTotalSpendUsd();
  if (spent + estimateUsd > cap) {
    throw new BudgetExceededError(spent, cap);
  }
}

export async function logAiCall(input: {
  provider: string;
  model: string;
  purpose: AiCallPurpose;
  inTokens: number;
  outTokens: number;
  costUsd: number;
  ms: number;
  ok: boolean;
}): Promise<void> {
  await db.insert(aiCalls).values({
    id: randomUUID(),
    provider: input.provider,
    model: input.model,
    purpose: input.purpose,
    inTokens: input.inTokens,
    outTokens: input.outTokens,
    costUsd: input.costUsd,
    ms: input.ms,
    ok: input.ok,
    createdAt: new Date(),
  });
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export class ProviderHttpError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly status: number,
    body: string,
  ) {
    super(`${provider} returned HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = "ProviderHttpError";
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var "${name}" — set it in .env.local`);
  return v;
}

// Rough fallback estimate (chars/4) for providers that omit usage in their
// response; real usage from the API response is always preferred.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

// 429/5xx are frequently transient on free tiers (upstream overload, shared
// rate limits) — a couple of short retries before handing off to the next
// provider in the chain meaningfully raises the odds a purpose-chain
// succeeds at all. `initFactory` (not a static init) so each attempt gets
// its own fresh AbortSignal.timeout instead of racing a shared deadline.
async function fetchWithRetry(url: string, initFactory: () => RequestInit): Promise<Response> {
  const delaysMs = [1000, 2500];
  let res = await fetch(url, initFactory());
  for (const delay of delaysMs) {
    if (res.status !== 429 && res.status < 500) return res;
    await new Promise((r) => setTimeout(r, delay));
    res = await fetch(url, initFactory());
  }
  return res;
}

async function callGemini(args: {
  system: string;
  user: string;
  temperature: number;
}): Promise<ProviderCallResult> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = requireEnv("GEMINI_MODEL_COPY");
  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.user }] }],
        generationConfig: {
          temperature: args.temperature,
          responseMimeType: "application/json",
          // These are short structured-output calls (copy/critic/plan JSON),
          // not open-ended reasoning — skip Gemini 3's thinking tokens so
          // responses stay fast and parts never carry stray `thought` text.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  );
  if (!res.ok) throw new ProviderHttpError("gemini", res.status, await safeText(res));
  const json = await res.json();
  const raw: string =
    json.candidates?.[0]?.content?.parts
      ?.filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "")
      .join("") ?? "";
  const inTokens = json.usageMetadata?.promptTokenCount ?? estimateTokens(args.system + args.user);
  const outTokens = json.usageMetadata?.candidatesTokenCount ?? estimateTokens(raw);
  return { provider: "gemini", model, raw, inTokens, outTokens, costUsd: 0 };
}

async function callOpenAiCompatible(
  provider: ProviderName,
  baseUrl: string,
  apiKeyEnv: string,
  modelEnv: string,
  args: { system: string; user: string; temperature: number },
): Promise<ProviderCallResult> {
  const apiKey = requireEnv(apiKeyEnv);
  const model = requireEnv(modelEnv);
  const res = await fetchWithRetry(`${baseUrl}/chat/completions`, () => ({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      temperature: args.temperature,
      // Reasoning models spend ~3k tokens thinking; the default cap truncated
      // larger JSON (the weekly report) mid-object.
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }));
  if (!res.ok) throw new ProviderHttpError(provider, res.status, await safeText(res));
  const json = await res.json();
  const raw: string = json.choices?.[0]?.message?.content ?? "";
  const inTokens = json.usage?.prompt_tokens ?? estimateTokens(args.system + args.user);
  const outTokens = json.usage?.completion_tokens ?? estimateTokens(raw);
  return { provider, model, raw, inTokens, outTokens, costUsd: estimateCostUsd(provider, inTokens, outTokens) };
}

// Dispatches to the real provider APIs. Gemini uses its native REST API
// (JSON mode via responseMimeType); Groq and OpenRouter are OpenAI-compatible
// chat/completions endpoints. See skill `ai-providers`.
async function callProvider(
  provider: ProviderName,
  args: { system: string; user: string; temperature: number },
): Promise<ProviderCallResult> {
  switch (provider) {
    case "gemini":
      return callGemini(args);
    case "groq":
      return callOpenAiCompatible("groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL_FAST", args);
    case "openrouter_free":
      return callOpenAiCompatible(
        "openrouter_free",
        "https://openrouter.ai/api/v1",
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODEL_FALLBACK",
        args,
      );
    case "openrouter_premium":
      return callOpenAiCompatible(
        "openrouter_premium",
        "https://openrouter.ai/api/v1",
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODEL_PREMIUM",
        args,
      );
  }
}

// Routes by `purpose`, walks the fallback chain on error, validates against
// `schema`, retries once (same provider) on a Zod failure with the error
// appended, and logs every attempt to the ai_calls ledger.
export async function generateJSON<T>(args: GenerateJSONArgs<T>): Promise<T> {
  const { purpose, system, user, schema, temperature = 0.7 } = args;
  const chain = providerChainFor(purpose);

  const attempts: { provider: ProviderName; reason: string }[] = [];
  for (const provider of chain) {
    const started = Date.now();
    try {
      await assertBudget(0);
      const result = await callProvider(provider, { system, user, temperature });
      const parsed = schema.safeParse(JSON.parse(stripCodeFences(result.raw)));
      if (parsed.success) {
        await logAiCall({ ...result, purpose, ms: Date.now() - started, ok: true });
        return parsed.data;
      }
      if (process.env.LLM_DEBUG) {
        console.error(`[llm debug] ${provider} schema mismatch (attempt 1):`, parsed.error.message, "\nraw:", result.raw);
      }

      const retryUser = `${user}\n\nYour previous response failed schema validation: ${parsed.error.message}\nReturn valid JSON matching the schema, nothing else.`;
      const retry = await callProvider(provider, { system, user: retryUser, temperature });
      const retryParsed = schema.safeParse(JSON.parse(stripCodeFences(retry.raw)));
      await logAiCall({ ...retry, purpose, ms: Date.now() - started, ok: retryParsed.success });
      if (retryParsed.success) return retryParsed.data;
      if (process.env.LLM_DEBUG) {
        console.error(`[llm debug] ${provider} schema mismatch (retry):`, retryParsed.error.message, "\nraw:", retry.raw);
      }
      attempts.push({ provider, reason: "schema validation failed twice" });
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
      attempts.push({ provider, reason: failureReason(err) });
      if (process.env.LLM_DEBUG) console.error(`[llm debug] ${provider} failed:`, err);
      await logAiCall({
        provider,
        model: "unknown",
        purpose,
        inTokens: 0,
        outTokens: 0,
        costUsd: 0,
        ms: Date.now() - started,
        ok: false,
      });
    }
  }
  console.error(
    `[llm] all providers exhausted for purpose "${purpose}": ` +
      attempts.map((a) => `${a.provider} (${a.reason})`).join(", "),
  );
  throw new AllProvidersExhaustedError(purpose, attempts);
}

function failureReason(err: unknown): string {
  if (err instanceof ProviderHttpError) return `HTTP ${err.status}`;
  if (err instanceof Error) return `${err.name}: ${err.message.slice(0, 120)}`;
  return String(err).slice(0, 120);
}

export async function getSpendSummary(): Promise<SpendSummary> {
  const cap = Number(process.env.BUDGET_USD_CAP ?? "20");
  const softCap = Number(process.env.BUDGET_USD_SOFT ?? String(cap * 0.75));
  const rows = await db.select({ costUsd: aiCalls.costUsd }).from(aiCalls);
  return {
    totalUsd: rows.reduce((sum, row) => sum + row.costUsd, 0),
    capUsd: cap,
    softCapUsd: softCap,
    callCount: rows.length,
  };
}
