"use server";

import { randomUUID } from "node:crypto";
import type { InsightCard, Report, ReportClaim } from "@/lib/types";

// M0 stub: realistic mock data with the final shape. Wired to
// src/lib/report/{facts,generate,verify,insights}.ts in M6.

function mockClaim(overrides: Partial<ReportClaim> = {}): ReportClaim {
  return {
    id: randomUUID(),
    statement: "Bengali captions on Instagram out-performed English by 38% on engagement rate.",
    postIds: ["P-1001", "P-1002", "P-1003"],
    metric: "engagementRate",
    verified: true,
    ...overrides,
  };
}

export async function generateWeeklyReport(weekStart: Date): Promise<Report> {
  const claims = [mockClaim()];
  return {
    id: randomUUID(),
    weekStart,
    claims,
    verified: true,
    markdown: `# Weekly report — week of ${weekStart.toISOString().slice(0, 10)}\n\n- ${claims[0].statement} ([${claims[0].postIds.join(", ")}])`,
    createdAt: new Date(),
  };
}

export async function getLatestReport(): Promise<Report | null> {
  return generateWeeklyReport(new Date());
}

export async function listInsights(activeOnly = true): Promise<InsightCard[]> {
  const insights: InsightCard[] = [
    {
      id: randomUUID(),
      reportId: "report-mock",
      statement: "Bengali outperforms English on Instagram engagement rate.",
      evidencePostIds: ["P-1001", "P-1002"],
      lever: "lang",
      recommendation: "Lead with Bengali copy for Instagram feed posts.",
      active: true,
    },
    {
      id: randomUUID(),
      reportId: "report-mock",
      statement: "Shorts posted after 7pm IST get 2x the completion rate.",
      evidencePostIds: ["P-1010", "P-1011"],
      lever: "time",
      recommendation: "Schedule YouTube Shorts for evening slots.",
      active: false,
    },
  ];
  return activeOnly ? insights.filter((i) => i.active) : insights;
}

export async function toggleInsight(insightId: string, active: boolean): Promise<InsightCard> {
  return {
    id: insightId,
    reportId: "report-mock",
    statement: "Bengali outperforms English on Instagram engagement rate.",
    evidencePostIds: ["P-1001", "P-1002"],
    lever: "lang",
    recommendation: "Lead with Bengali copy for Instagram feed posts.",
    active,
  };
}
