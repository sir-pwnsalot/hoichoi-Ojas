import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { db } from "@/db";
import { aiCalls } from "@/db/schema";
import type { SpendSummary } from "@/lib/types";

// Every AI call in this app goes through generateJSON() — never call a
// provider SDK directly from a route or action. See skill `ai-providers`.

export type LlmPurpose = "copy" | "critic" | "plan" | "report" | "insight_extraction";

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
    default:
      return premium ? ["gemini", "openrouter_premium"] : ["gemini", "openrouter_free"];
  }
}

async function getTotalSpendUsd(): Promise<number> {
  const rows = await db.select({ costUsd: aiCalls.costUsd }).from(aiCalls);
  return rows.reduce((sum, row) => sum + row.costUsd, 0);
}

async function assertBudget(estimateUsd: number): Promise<void> {
  const cap = Number(process.env.BUDGET_USD_CAP ?? "20");
  const spent = await getTotalSpendUsd();
  if (spent + estimateUsd > cap) {
    throw new BudgetExceededError(spent, cap);
  }
}

async function logAiCall(input: {
  provider: string;
  model: string;
  purpose: LlmPurpose;
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

// TODO(M1): wire real provider calls (Gemini, Groq, OpenRouter) per
// ai-providers skill. Throws so M0 callers fail loudly instead of the
// router silently pretending to have called a model.
async function callProvider(
  provider: ProviderName,
  _args: { system: string; user: string; temperature: number },
): Promise<ProviderCallResult> {
  throw new Error(`Provider "${provider}" is not wired up yet (M0 skeleton)`);
}

// Routes by `purpose`, walks the fallback chain on error, validates against
// `schema`, retries once (same provider) on a Zod failure with the error
// appended, and logs every attempt to the ai_calls ledger.
export async function generateJSON<T>(args: GenerateJSONArgs<T>): Promise<T> {
  const { purpose, system, user, schema, temperature = 0.7 } = args;
  const chain = providerChainFor(purpose);

  let lastError: unknown;
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

      const retryUser = `${user}\n\nYour previous response failed schema validation: ${parsed.error.message}\nReturn valid JSON matching the schema, nothing else.`;
      const retry = await callProvider(provider, { system, user: retryUser, temperature });
      const retryParsed = schema.safeParse(JSON.parse(stripCodeFences(retry.raw)));
      await logAiCall({ ...retry, purpose, ms: Date.now() - started, ok: retryParsed.success });
      if (retryParsed.success) return retryParsed.data;
      lastError = retryParsed.error;
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
      lastError = err;
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
  throw lastError instanceof Error
    ? lastError
    : new Error(`All providers failed for purpose "${purpose}"`);
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
