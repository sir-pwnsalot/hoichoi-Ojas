// Seeded weekly report: built deterministically from the facts table (no LLM,
// so the live link works without API calls), then run through the SAME
// verifier as generated reports. Idempotent by fixed ids.

import type { AggregateFact, WeekFacts } from "../src/lib/report/facts";
import type { DraftClaim, DraftInsight, ReportDraft } from "../src/lib/report/generate";

export const SEED_REPORT_ID = "seed-report-1";
export const SEED_INSIGHT_IDS = ["seed-ins-lang", "seed-ins-cta", "seed-ins-channel", "seed-ins-time"];

export function buildSeedDraft(f: WeekFacts): ReportDraft {
  const a = (key: string): AggregateFact => {
    const x = f.aggregates.find((g) => g.key === key);
    if (!x) throw new Error(`seed report: facts table has no aggregate "${key}"`);
    return x;
  };
  const cite = (ids: string[]) => ids.map((id) => `[${id}]`).join(" ");
  const uniq = (...lists: string[][]) => [...new Set(lists.flat())];
  const fig = (x: AggregateFact) => ({ metric: x.key, value: x.value });
  const claim = (text: (c: string) => string, aggs: AggregateFact[], extraIds: string[] = []): DraftClaim => {
    const postIds = uniq(...aggs.map((x) => x.postIds), extraIds);
    return { text: text(cite(postIds)), postIds, figures: aggs.map(fig) };
  };
  const byLang = (ch: string, lang: string) => f.posts.filter((p) => p.channel === ch && p.lang === lang).map((p) => p.id);

  const [igBn, igEn, igLift] = [a("er.instagram.bn"), a("er.instagram.en"), a("bnLift.instagram")];
  const [ytBn, ytEn, ytLift] = [a("er.youtube.bn"), a("er.youtube.en"), a("bnLift.youtube")];
  const xLift = a("bnLift.x");
  const [shYt, shIg, shX] = [a("shareRate.youtube"), a("shareRate.instagram"), a("shareRate.x")];
  const [q, w] = [a("er.cta.question"), a("er.cta.watch")];
  const [eve, day] = [a("er.time.evening"), a("er.time.daytime")];
  const compl = a("completion.youtube");
  const top = f.posts.find((p) => p.id === a("top.engagementRate").postIds[0])!;
  const bottom = f.posts.find((p) => p.id === a("bottom.engagementRate").postIds[0])!;

  const summary: DraftClaim[] = [
    claim((c) => `Bengali led English on Instagram: ${igBn.value}% vs ${igEn.value}% mean engagement, a ${igLift.value}% lift ${c}.`, [igBn, igEn, igLift]),
    claim((c) => `YouTube Shorts had the highest share rate at ${shYt.value}%, vs ${shIg.value}% on Instagram and ${shX.value}% on X ${c}.`, [shYt, shIg, shX]),
    {
      text: `Top post was [${top.id}] (${top.channel} ${top.lang}, ${top.ctaType} CTA) at ${top.engagementRate}% engagement; the weakest was [${bottom.id}] (${bottom.channel} ${bottom.lang}) at ${bottom.engagementRate}%.`,
      postIds: [top.id, bottom.id],
      figures: [
        { postId: top.id, metric: "engagementRate", value: top.engagementRate },
        { postId: bottom.id, metric: "engagementRate", value: bottom.engagementRate },
      ],
    },
  ];

  const sections: ReportDraft["sections"] = [
    {
      title: "Bengali vs English",
      claims: [
        claim((c) => `On Shorts, Bengali posts averaged ${ytBn.value}% engagement vs ${ytEn.value}% for English, a ${ytLift.value}% lift ${c}.`, [ytBn, ytEn, ytLift]),
        claim((c) => `On X the two languages were near parity (Bengali lift ${xLift.value}%) ${c}.`, [xLift]),
      ],
    },
    {
      title: "CTA & format",
      claims: [
        claim((c) => `Question CTAs averaged ${q.value}% engagement vs ${w.value}% for watch-now CTAs ${c}.`, [q, w]),
        claim((c) => `Shorts viewers watched ${compl.value}% of each clip on average (completion proxy) ${c}.`, [compl]),
      ],
    },
    {
      title: "Timing",
      claims: [claim((c) => `Posts published 18:00 IST or later averaged ${eve.value}% engagement vs ${day.value}% for daytime posts ${c}.`, [eve, day])],
    },
  ];

  const insights: DraftInsight[] = [
    {
      statement: `Bengali copy lifts engagement on Instagram (+${igLift.value}%) and Shorts (+${ytLift.value}%), but not on X.`,
      lever: "lang",
      recommendation: "Lead Instagram and Shorts with the Bengali variant (native Bengali hook in the first line); keep X bilingual.",
      evidencePostIds: uniq(byLang("instagram", "bn"), byLang("instagram", "en"), byLang("youtube", "bn"), byLang("youtube", "en")),
    },
    {
      statement: `Question CTAs out-engage watch-now CTAs (${q.value}% vs ${w.value}%).`,
      lever: "cta",
      recommendation: "End Instagram and Shorts captions with a Bengali question CTA that invites a comment guess.",
      evidencePostIds: uniq(q.postIds, w.postIds),
    },
    {
      statement: `Shorts is the share engine: ${shYt.value}% share rate vs ${shIg.value}% on Instagram.`,
      lever: "channel",
      recommendation: "Make the Shorts cut the hero asset: put the most shareable reveal in the first 2 seconds.",
      evidencePostIds: uniq(shYt.postIds, shIg.postIds),
    },
    {
      statement: `Evening posts (18:00+ IST) beat daytime posts on engagement (${eve.value}% vs ${day.value}%).`,
      lever: "time",
      recommendation: "Schedule Instagram and Shorts between 19:00 and 21:00 IST.",
      evidencePostIds: uniq(eve.postIds, day.postIds),
    },
  ];

  return { summary, sections, insights };
}
