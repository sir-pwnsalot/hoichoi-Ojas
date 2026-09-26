"use server";

import { getSpendSummary } from "@/lib/ai/llm";
import type { SpendSummary } from "@/lib/types";

export async function getSpend(): Promise<SpendSummary> {
  return getSpendSummary();
}
