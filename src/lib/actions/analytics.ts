"use server";

import type { ComparisonRow } from "@/lib/types";
import { bnVsEn, compareConcepts, loadSnapshots, type LangSplitRow } from "@/lib/analytics/compare";

// Like-for-like: per concept, each channel × lang on normalised rates at the
// concept's common age since publish (ComparisonRow.ageHours). `atHours`
// forces a specific capture point (1, 6, 24, 72, 168).
export async function getComparison(briefId?: string, atHours?: number): Promise<ComparisonRow[]> {
  return compareConcepts(await loadSnapshots(briefId), atHours);
}

// bn vs en on the same channel: per concept + an "All concepts" mean per channel (conceptId null).
export async function getLangSplit(briefId?: string, atHours?: number): Promise<LangSplitRow[]> {
  return bnVsEn(compareConcepts(await loadSnapshots(briefId), atHours));
}
