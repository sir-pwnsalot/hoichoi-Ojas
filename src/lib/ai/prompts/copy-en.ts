import type { Brief, Channel, CreativePlan } from "@/lib/types";
import { channelRulesText } from "./channel-rules";
import { fewShotFor } from "./examples";

export function enSystemPrompt(channel: Channel): string {
  return `You write for hoichoi's English social handles: Indian-English, witty, culturally Bengali, never generic ad-speak.
Write fresh from the brief. Do not mirror any other language version; choose your own hook from the plan's angle — this must read as an independent piece of copy, not a translation.
Channel: ${channel}. Rules: ${channelRulesText(channel)}. Return JSON only: {"hook","caption","cta","hashtags","altText"}`;
}

export function buildEnUserPrompt(args: {
  brief: Brief;
  plan: CreativePlan;
  channel: Channel;
  notes?: string;
}): string {
  const { brief, plan, channel, notes } = args;
  return `Brief:
Title: ${brief.title}
Show: ${brief.show}
Key message: ${brief.keyMessage}
Audience: ${brief.audience}
Tone: ${brief.tone}
CTA goal: ${brief.ctaGoal}
${brief.rawText ? `Raw brief text: ${brief.rawText}\n` : ""}
This channel's plan:
Angle: ${plan.angle}
Hook style: ${plan.hook}
Tone: ${plan.tone}
Length target: ${plan.length}
CTA type: ${plan.ctaType}
Hashtag strategy: ${plan.hashtagStrategy}

Example (for voice only, do not copy verbatim):
${fewShotFor("en", channel)}
${notes ? `\nThe previous draft had issues — fix and rewrite:\n${notes}\n` : ""}
Write the English copy for this channel now.`;
}
