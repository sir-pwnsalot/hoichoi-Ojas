import { desc, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { insights, reports } from "@/db/schema";
import type { InsightCard, Lever, Report, ReportClaim } from "@/lib/types";
import type { WeekFacts } from "./facts";
import type { DraftClaim, GroundedReport } from "./generate";

// Report + insight-card persistence. Insights from the newest report are the
// active cards the brief form offers (the loop, non-negotiable #5).

type InsightRow = typeof insights.$inferSelect;
type ReportRow = typeof reports.$inferSelect;

export function rowToInsight(r: InsightRow): InsightCard {
  return {
    id: r.id,
    reportId: r.reportId,
    statement: r.statement,
    evidencePostIds: r.evidencePostIds,
    lever: r.lever as Lever,
    recommendation: r.recommendation,
    active: r.active,
  };
}

function toClaim(c: DraftClaim, section: string): ReportClaim {
  return {
    id: randomUUID(),
    statement: c.text,
    postIds: c.postIds,
    metric: c.figures[0]?.metric ?? "",
    verified: true, // only verified claims are ever stored as claims
    section,
    figures: c.figures,
  };
}

export function renderMarkdown(r: {
  weekStart: Date;
  claims: ReportClaim[];
  verified: boolean;
  unverifiedReasons: string[];
  insights: Pick<InsightCard, "lever" | "statement" | "recommendation" | "evidencePostIds">[];
}): string {
  const lines = [`# Weekly report — week of ${new Date(r.weekStart.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)} (IST)`, ""];
  lines.push(r.verified ? "_All claims verified against the facts table._" : "_**Unverified:** some claims failed verification and were removed._");
  const sections = [...new Set(r.claims.map((c) => c.section ?? "Summary"))];
  for (const s of sections) {
    lines.push("", `## ${s}`, ...r.claims.filter((c) => (c.section ?? "Summary") === s).map((c) => `- ${c.statement}`));
  }
  if (r.insights.length) {
    lines.push("", "## Insights for the next brief");
    for (const i of r.insights) {
      lines.push(`- **${i.lever}** — ${i.statement} → ${i.recommendation} (${i.evidencePostIds.map((id) => `[${id}]`).join(" ")})`);
    }
  }
  if (!r.verified) lines.push("", "## Removed by the verifier", ...r.unverifiedReasons.map((e) => `- ${e}`));
  return lines.join("\n");
}

// Saves the report and its insights as active cards; older cards go inactive.
export async function saveReport(
  facts: WeekFacts,
  g: GroundedReport,
  ids: { reportId?: string; insightIds?: string[] } = {},
  createdAt = new Date(),
): Promise<Report> {
  const reportId = ids.reportId ?? randomUUID();
  const claims = [
    ...g.draft.summary.map((c) => toClaim(c, "Summary")),
    ...g.draft.sections.flatMap((s) => s.claims.map((c) => toClaim(c, s.title))),
  ];
  const cards: InsightCard[] = g.draft.insights.map((i, k) => ({
    id: ids.insightIds?.[k] ?? randomUUID(),
    reportId,
    statement: i.statement,
    evidencePostIds: i.evidencePostIds,
    lever: i.lever,
    recommendation: i.recommendation,
    active: true,
  }));
  const weekStart = new Date(facts.weekStart);
  const markdown = renderMarkdown({ weekStart, claims, verified: g.verified, unverifiedReasons: g.unverifiedReasons, insights: cards });

  await db.insert(reports).values({
    id: reportId,
    weekStart,
    claimsJson: claims,
    verified: g.verified,
    unverifiedReasons: g.unverifiedReasons,
    markdown,
    createdAt,
  });
  await db.update(insights).set({ active: false }).where(ne(insights.reportId, reportId));
  if (cards.length) await db.insert(insights).values(cards);

  return rowToReport((await db.select().from(reports).where(eq(reports.id, reportId)))[0], cards);
}

export function rowToReport(r: ReportRow, cards: InsightCard[]): Report {
  const weekStart = r.weekStart;
  return {
    id: r.id,
    weekStart,
    weekEnd: new Date(weekStart.getTime() + 7 * 86_400_000),
    claims: r.claimsJson as ReportClaim[],
    verified: r.verified,
    unverifiedReasons: r.unverifiedReasons ?? [],
    insights: cards,
    markdown: r.markdown,
    createdAt: r.createdAt,
  };
}

export async function latestReport(): Promise<Report | null> {
  const [r] = await db.select().from(reports).orderBy(desc(reports.createdAt)).limit(1);
  if (!r) return null;
  const cards = (await db.select().from(insights).where(eq(insights.reportId, r.id))).map(rowToInsight);
  return rowToReport(r, cards);
}

export async function listInsightCards(activeOnly: boolean): Promise<InsightCard[]> {
  const q = db.select({ i: insights }).from(insights).innerJoin(reports, eq(insights.reportId, reports.id)).orderBy(desc(reports.createdAt));
  const rows = activeOnly ? await q.where(eq(insights.active, true)) : await q;
  return rows.map((r) => rowToInsight(r.i));
}

export async function setInsightActive(insightId: string, active: boolean): Promise<InsightCard> {
  await db.update(insights).set({ active }).where(eq(insights.id, insightId));
  const [row] = await db.select().from(insights).where(eq(insights.id, insightId));
  if (!row) throw new Error(`Insight "${insightId}" not found`);
  return rowToInsight(row);
}
