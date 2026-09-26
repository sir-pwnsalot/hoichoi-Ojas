"use server";

import { requestTime } from "@/lib/request-time";
import { getSpendSummary } from "@/lib/ai/llm";
import type { SpendSummary } from "@/lib/types";

export async function getSpend(): Promise<SpendSummary> {
  await requestTime();
  return getSpendSummary();
}
