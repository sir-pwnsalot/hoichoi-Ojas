import { z } from "zod";
import type { CopyResult } from "./copy-schema";

export const criticRawSchema = z.object({
  score: z.number().min(1).max(5),
  register: z.enum(["chalit", "sadhu", "mixed"]),
  flags: z.array(z.object({ phrase: z.string(), why: z.string(), rewrite: z.string() })),
  verdict: z.enum(["native", "translated-feel"]),
});

export type CriticRaw = z.infer<typeof criticRawSchema>;

export const CRITIC_SYSTEM_PROMPT = `You are a Kolkata-based social-media editor who has written Bengali copy for OTT brands for years.
Judge whether this Bengali copy reads as natively written or as translated from English.
Check: register (chalit vs sadhu), calques, Sanskritised formal verbs, pronoun-heavy English word order, overuse of এবং/এটি, literal idioms.
Return JSON: {"score":1-5,"register":"chalit|sadhu|mixed","flags":[{"phrase","why","rewrite"}],"verdict":"native|translated-feel"}`;

export function buildCriticUserPrompt(bnCopy: CopyResult): string {
  return `Bengali copy to judge:
Hook: ${bnCopy.hook}
Caption: ${bnCopy.caption}
CTA: ${bnCopy.cta}
Hashtags: ${bnCopy.hashtags.join(" ")}

Reference of translated-feel red flags: calqued questions ("আপনি কি প্রস্তুত"), formal Sanskritised verbs (উপলব্ধ/প্রদর্শিত/সম্প্রচারিত), এবং overuse, এটি/সেটি in casual copy, literal idioms ("এর জন্য অপেক্ষা করুন"), sadhu-chalit mixing.

Judge now.`;
}
