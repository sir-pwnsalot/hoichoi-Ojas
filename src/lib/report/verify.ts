import { POST_METRICS, type PostMetric, type WeekFacts } from "./facts";
import type { DraftClaim, DraftInsight, ReportDraft } from "./generate";

// Deterministic claim verifier (grounded-reporting, non-negotiable #5).
// No LLM here: every check is against the facts table computed in code.

const POST_ID_RE = /\[(P-\d+)\]/g;
const PCT_RE = /(\d+(?:\.\d+)?)\s*%/g;

function decimals(n: number): number {
  const s = String(n);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

// ±0.5% relative, or equal when the true value is rounded to the claimed precision.
export function figureMatches(actual: number, claimed: number): boolean {
  if (Math.abs(actual - claimed) <= Math.abs(actual) * 0.005) return true;
  const f = 10 ** decimals(claimed);
  return Math.round(actual * f) / f === claimed;
}

function postIdErrors(ids: string[], facts: WeekFacts, byId: Set<string>): string[] {
  const other = new Set(facts.otherPostIds);
  const errs: string[] = [];
  for (const id of ids) {
    if (byId.has(id)) continue;
    errs.push(other.has(id) ? `${id} was not published in the report week (outside the report week)` : `${id} does not exist`);
  }
  return errs;
}

export function verifyClaim(claim: DraftClaim, facts: WeekFacts): string[] {
  const errs: string[] = [];
  const weekIds = new Set(facts.posts.map((p) => p.id));

  if (!claim.postIds.length) errs.push("claim cites no post ID");
  for (const [, id] of claim.text.matchAll(POST_ID_RE)) {
    if (!claim.postIds.includes(id)) errs.push(`inline [${id}] is not in postIds`);
  }
  errs.push(...postIdErrors(claim.postIds, facts, weekIds));

  const checked: number[] = [];
  for (const fig of claim.figures) {
    let actual: number | null | undefined;
    if (fig.postId) {
      if (!claim.postIds.includes(fig.postId)) errs.push(`figure postId ${fig.postId} is not in postIds`);
      const post = facts.posts.find((p) => p.id === fig.postId);
      if (!post) continue; // already reported above
      if (!(POST_METRICS as readonly string[]).includes(fig.metric)) {
        errs.push(`unknown metric "${fig.metric}" for ${fig.postId}`);
        continue;
      }
      actual = post[fig.metric as PostMetric];
    } else {
      const agg = facts.aggregates.find((a) => a.key === fig.metric);
      if (!agg) {
        errs.push(`unknown metric "${fig.metric}" (not in the facts table)`);
        continue;
      }
      actual = agg.value;
    }
    if (actual == null) {
      errs.push(`${fig.metric}${fig.postId ? ` for ${fig.postId}` : ""} has no value in the facts table`);
      continue;
    }
    if (!figureMatches(actual, fig.value)) {
      errs.push(`${fig.metric}${fig.postId ? ` for ${fig.postId}` : ""} is ${fig.value} in the claim but ${actual} in the facts table`);
    } else {
      checked.push(fig.value);
    }
  }

  // Every percentage written in the text must be one of the verified figures.
  for (const [raw, num] of claim.text.matchAll(PCT_RE)) {
    const n = Number(num);
    if (!checked.some((v) => figureMatches(Math.abs(v), n) || figureMatches(n, Math.abs(v)))) {
      errs.push(`"${raw}" in the text is not backed by a verified figure`);
    }
  }
  return errs;
}

export function verifyInsight(ins: DraftInsight, facts: WeekFacts): string[] {
  const errs: string[] = [];
  if (!ins.evidencePostIds.length) errs.push("insight cites no evidence post ID");
  errs.push(...postIdErrors(ins.evidencePostIds, facts, new Set(facts.posts.map((p) => p.id))));
  return errs;
}

export interface ClaimCheck {
  section: string; // "Summary" or the section title
  claim: DraftClaim;
  errors: string[];
}

export interface InsightCheck {
  insight: DraftInsight;
  errors: string[];
}

export interface VerifyResult {
  ok: boolean;
  claims: ClaimCheck[];
  insights: InsightCheck[];
  errors: string[]; // flat, human-readable — fed back to the model on regenerate
}

export function verifyDraft(draft: ReportDraft, facts: WeekFacts): VerifyResult {
  const claims: ClaimCheck[] = [
    ...draft.summary.map((claim) => ({ section: "Summary", claim })),
    ...draft.sections.flatMap((s) => s.claims.map((claim) => ({ section: s.title, claim }))),
  ].map((c) => ({ ...c, errors: verifyClaim(c.claim, facts) }));
  const insights = draft.insights.map((insight) => ({ insight, errors: verifyInsight(insight, facts) }));
  const errors = [
    ...claims.filter((c) => c.errors.length).map((c) => `Claim "${c.claim.text}": ${c.errors.join("; ")}`),
    ...insights.filter((i) => i.errors.length).map((i) => `Insight "${i.insight.statement}": ${i.errors.join("; ")}`),
  ];
  return { ok: errors.length === 0, claims, insights, errors };
}
