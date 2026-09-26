import type { Brief, Channel, CreativePlan } from "@/lib/types";
import { channelRulesText } from "./channel-rules";
import { fewShotFor } from "./examples";

// Written in Bengali on purpose — a Bengali instruction frame pulls the
// model into Bengali idiom far better than an English prompt that says
// "write in Bengali". See skill bengali-native-copy/prompts.md.
export function bnSystemPrompt(channel: Channel, address: "আপনি" | "তুমি"): string {
  return `আপনি hoichoi-এর সোশ্যাল মিডিয়া টিমের একজন অভিজ্ঞ বাঙালি কপিরাইটার। কলকাতায় বড় হয়েছেন, রোজ বাংলায় পোস্ট লেখেন।
নিয়ম:
- চলিত বাংলায় লিখুন, যেভাবে কলকাতার লোকে কথা বলে। সাধু ভাষা একদম নয়।
- কোনও ইংরেজি লেখা অনুবাদ করবেন না। ব্রিফ পড়ে সরাসরি বাংলায় ভাবুন আর লিখুন।
- যেখানে লোকে স্বাভাবিকভাবে ইংরেজি শব্দ বলে (সিরিজ, ট্রেলার, এপিসোড), বাংলা হরফে সেটাই লিখুন।
- "উপলব্ধ", "প্রদর্শিত", "আপনি কি প্রস্তুত" — এই ধরনের অনুবাদ-গন্ধওয়ালা শব্দ বা বাক্য চলবে না। "এবং"-এর বদলে "আর"।
- ব্র্যান্ডের নাম সবসময় "hoichoi" (ইংরেজি হরফে, ছোট হাতের)।
- সম্বোধন: ${address}।
- প্ল্যাটফর্ম: ${channel}। নিয়ম: ${channelRulesText(channel)}
- শুধু JSON ফেরত দিন: {"hook","caption","cta","hashtags","altText"}`;
}

// Playful/youth-targeted briefs get তুমি; otherwise the default আপনি.
// Keep this heuristic simple — a human can always edit the tone field later.
export function pickAddress(brief: Brief): "আপনি" | "তুমি" {
  const tone = brief.tone.toLowerCase();
  return /playful|youth|casual|fun|witty-young/.test(tone) ? "তুমি" : "আপনি";
}

export function buildBnUserPrompt(args: {
  brief: Brief;
  plan: CreativePlan;
  channel: Channel;
  notes?: string;
}): string {
  const { brief, plan, channel, notes } = args;
  return `ব্রিফ:
শিরোনাম: ${brief.title}
শো: ${brief.show}
মূল বার্তা: ${brief.keyMessage}
দর্শক: ${brief.audience}
টোন: ${brief.tone}
CTA লক্ষ্য: ${brief.ctaGoal}
${brief.rawText ? `ব্রিফের মূল লেখা: ${brief.rawText}\n` : ""}
এই চ্যানেলের প্ল্যান:
অ্যাঙ্গেল: ${plan.angle}
হুক স্টাইল: ${plan.hook}
টোন: ${plan.tone}
লেংথ টার্গেট: ${plan.length}
CTA টাইপ: ${plan.ctaType}
হ্যাশট্যাগ স্ট্র্যাটেজি: ${plan.hashtagStrategy}

উদাহরণ (স্টাইল বোঝার জন্য, হুবহু কপি করবেন না):
${fewShotFor("bn", channel)}
${notes ? `\nআগের ভার্সনে সমস্যা ধরা পড়েছে — ঠিক করে আবার লিখুন:\n${notes}\n` : ""}
এখন এই চ্যানেলের জন্য বাংলা কপি লিখুন। প্ল্যানের অ্যাঙ্গেল থেকে নিজের হুক বেছে নিন — এটা অনুবাদ নয়, নিজের ভাষায় ভাবা কপি।`;
}
