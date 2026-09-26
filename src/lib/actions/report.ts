"use server";

import type { InsightCard, Report } from "@/lib/types";
import { now } from "@/lib/domain/clock";
import { loadWeekFacts, WEEK_MS } from "@/lib/report/facts";
import { generateGroundedReport } from "@/lib/report/generate";
import { latestReport, listInsightCards, saveReport, setInsightActive } from "@/lib/report/insights";

// facts (code) → claims (LLM) → verify (code, regenerate once) → drop
// failures → save report + its insights as active cards.
// weekStart defaults to the 7 days ending at the app clock's now.
export async function generateWeeklyReport(weekStart?: Date): Promise<Report> {
  const start = weekStart ?? new Date((await now()).getTime() - WEEK_MS);
  const facts = await loadWeekFacts(start);
  if (!facts.posts.length) {
    throw new Error(`No published posts with metrics in the week of ${start.toISOString().slice(0, 10)}`);
  }
  return saveReport(facts, await generateGroundedReport(facts));
}

export async function getLatestReport(): Promise<Report | null> {
  return latestReport();
}

export async function listInsights(activeOnly = true): Promise<InsightCard[]> {
  return listInsightCards(activeOnly);
}

export async function toggleInsight(insightId: string, active: boolean): Promise<InsightCard> {
  return setInsightActive(insightId, active);
}
