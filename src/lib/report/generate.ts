import { z } from "zod";
import { generateJSON } from "@/lib/ai/llm";
import type { WeekFacts } from "./facts";
import { verifyDraft, type VerifyResult } from "./verify";

// Weekly report as JSON claims (grounded-reporting). The model gets the
// facts table and may only quote it; verify.ts is the authority.

const claimSchema = z.object({
  text: z.string().min(1),
  postIds: z.array(z.string()),
  figures: z.array(z.object({ postId: z.string().optional(), metric: z.string(), value: z.number() })),
});

const insightSchema = z.object({
  statement: z.string().min(1),
  lever: z.enum(["lang", "channel", "cta", "time", "format", "hook"]),
  recommendation: z.string().min(1),
  evidencePostIds: z.array(z.string()),
});

export const reportDraftSchema = z.object({
  summary: z.array(claimSchema),
  sections: z.array(z.object({ title: z.string().min(1), claims: z.array(claimSchema) })),
  insights: z.array(insightSchema),
});

export type DraftClaim = z.infer<typeof claimSchema>;
export type DraftInsight = z.infer<typeof insightSchema>;
export type ReportDraft = z.infer<typeof reportDraftSchema>;

export const REPORT_SYSTEM_PROMPT = `You are hoichoi's social analytics lead writing the weekly cross-platform report (Instagram, X, YouTube Shorts; Bengali and English posts).

You receive a FACTS table computed in code. Rules — a deterministic verifier rejects anything that breaks them:
- Use ONLY numbers that appear in the facts table. Never compute, average, round differently or estimate a number yourself. Rates are already in percent.
- Every claim cites at least one post ID. Write cited IDs inline as [P-1234] and list every one of them in "postIds". Only cite posts in facts.posts.
- Every number in a claim's text must be listed in "figures": { "postId": "P-1234", "metric": "engagementRate", "value": 5.21 } for a per-post value (metric is one of engagementRate, shareRate, saveRate, completionProxy, impressions), or { "metric": "<aggregate key>", "value": 36.8 } for an aggregate from facts.aggregates (cite that aggregate's postIds).
- Compare like for like: same concept, same channel, rates not raw totals.
- 2–3 summary claims, then 2–4 sections (e.g. "Bengali vs English", "Channel comparison", "CTA & timing") with 1–3 claims each.
- 2–4 insights: each is actionable, uses exactly ONE lever (lang | channel | cta | time | format | hook), gives a concrete recommendation for the next brief, and lists evidencePostIds from facts.posts.

Return JSON only, exactly this shape:
{ "summary": [Claim], "sections": [{ "title": "...", "claims": [Claim] }], "insights": [{ "statement": "...", "lever": "lang", "recommendation": "...", "evidencePostIds": ["P-1234"] }] }
Claim = { "text": "... [P-1234] ...", "postIds": ["P-1234"], "figures": [{ "postId": "P-1234", "metric": "engagementRate", "value": 5.21 }] }`;

export function buildReportUserPrompt(facts: WeekFacts, feedback?: string[]): string {
  const { otherPostIds: _omit, ...shown } = facts;
  void _omit;
  let prompt = `Report week: ${facts.weekStart.slice(0, 10)} to ${facts.weekEnd.slice(0, 10)} (${facts.posts.length} posts).\n\nFACTS:\n${JSON.stringify(shown)}`;
  if (feedback?.length) {
    prompt += `\n\nYour previous draft FAILED verification. Fix or remove these claims/insights:\n${feedback.map((e) => `- ${e}`).join("\n")}`;
  }
  return prompt + "\n\nWrite the report JSON now.";
}

export async function draftReport(facts: WeekFacts, feedback?: string[]): Promise<ReportDraft> {
  return generateJSON({
    purpose: "report",
    system: REPORT_SYSTEM_PROMPT,
    user: buildReportUserPrompt(facts, feedback),
    schema: reportDraftSchema,
    temperature: 0.3,
  });
}

export interface GroundedReport {
  draft: ReportDraft; // only the claims/insights that passed
  verified: boolean; // false if anything had to be dropped
  unverifiedReasons: string[]; // why claims/insights were dropped
  attempts: number;
}

// Keep only what passed; anything dropped makes the report unverified.
export function keepPassing(v: VerifyResult): { draft: ReportDraft; dropped: string[] } {
  const sections = new Map<string, ReportDraft["sections"][number]>();
  const summary: DraftClaim[] = [];
  for (const c of v.claims) {
    if (c.errors.length) continue;
    if (c.section === "Summary") summary.push(c.claim);
    else {
      if (!sections.has(c.section)) sections.set(c.section, { title: c.section, claims: [] });
      sections.get(c.section)!.claims.push(c.claim);
    }
  }
  return {
    draft: { summary, sections: [...sections.values()], insights: v.insights.filter((i) => !i.errors.length).map((i) => i.insight) },
    dropped: v.errors,
  };
}

// draft → verify → (regenerate once with the errors) → drop failures.
export async function generateGroundedReport(
  facts: WeekFacts,
  draftFn: (facts: WeekFacts, feedback?: string[]) => Promise<ReportDraft> = draftReport,
): Promise<GroundedReport> {
  let draft = await draftFn(facts);
  let v = verifyDraft(draft, facts);
  let attempts = 1;
  if (!v.ok) {
    draft = await draftFn(facts, v.errors);
    v = verifyDraft(draft, facts);
    attempts = 2;
  }
  const { draft: kept, dropped } = keepPassing(v);
  return { draft: kept, verified: dropped.length === 0, unverifiedReasons: dropped, attempts };
}
