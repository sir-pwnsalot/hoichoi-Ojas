// USD price per 1M tokens, used only to estimate cost for paid calls
// (free-tier providers always log costUsd = 0). Update from each provider's
// pricing page before switching LLM_TIER=premium; override via env without
// a code change.
export const PREMIUM_PRICE_PER_1M = {
  inUsd: Number(process.env.OPENROUTER_PREMIUM_PRICE_IN ?? "3"),
  outUsd: Number(process.env.OPENROUTER_PREMIUM_PRICE_OUT ?? "15"),
};

export function estimateCostUsd(provider: string, inTokens: number, outTokens: number): number {
  if (provider !== "openrouter_premium") return 0;
  return (inTokens / 1_000_000) * PREMIUM_PRICE_PER_1M.inUsd + (outTokens / 1_000_000) * PREMIUM_PRICE_PER_1M.outUsd;
}
