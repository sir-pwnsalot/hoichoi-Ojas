import type { Channel, Lang } from "@/lib/types";

// Few-shot examples from .claude/skills/bengali-native-copy/examples.md.
// Fictional show ("Dhonyasha") — never present these as real hoichoi
// titles; they exist purely to anchor voice and register.
const BN: Record<Channel, string> = {
  instagram: `রাত ১২টা। ফাঁকা বাড়ি। আর দেওয়ালে একটা হাতের ছাপ — কাল অবধি যেটা ছিল না। 👀

'ধোঁয়াশা' আসছে ১৭ অক্টোবর, শুধু hoichoi-তে।
আপনার সন্দেহ কার উপর? কমেন্টে লিখে ফেলুন 👇

#Dhonyasha #hoichoi #BengaliThriller #নতুনসিরিজ`,
  x: `উত্তর কলকাতার সবচেয়ে চুপচাপ পাড়াটাতেই সবচেয়ে বেশি গোপন কথা। 'ধোঁয়াশা' — ১৭ অক্টোবর, hoichoi-তে। #Dhonyasha`,
  youtube: `Title: দেওয়ালে হাতের ছাপটা কার? 😨 | ধোঁয়াশা | hoichoi
Description: তালাবন্ধ বাড়ি, অথচ ভিতরে কেউ ছিল। ১৭ অক্টোবর থেকে পুরো সিরিজ hoichoi-তে। #Shorts #Dhonyasha #hoichoi`,
};

// English youtube example is invented in the same voice (examples.md only
// shows instagram + x for en) — style anchor only, not a literal template.
const EN: Record<Channel, string> = {
  instagram: `Every para has that one house nobody talks about. This one just left a handprint. 🖐️

Dhonyasha streams 17 Oct, only on hoichoi.
Tag the friend who'd solve this before episode 2 👇

#Dhonyasha #hoichoi #BengaliThriller #WhodunitSeason`,
  x: `Locked door. Empty house. Fresh handprint. North Kolkata has a new mystery. Dhonyasha, 17 Oct on hoichoi. #Dhonyasha`,
  youtube: `Title: Who left the handprint? 😨 | Dhonyasha | hoichoi
Description: Locked house, someone was still inside. Full series streams 17 Oct on hoichoi. #Shorts #Dhonyasha #hoichoi`,
};

// Counter-example the nativeness critic should score ≤2 (translated feel).
export const TRANSLATED_FEEL_COUNTER_EXAMPLE =
  "আপনি কি একটি রোমাঞ্চকর যাত্রার জন্য প্রস্তুত? ধোঁয়াশা এখন hoichoi-তে উপলব্ধ হবে এবং এটি আপনাকে আপনার আসনের প্রান্তে রাখবে।";

export function fewShotFor(lang: Lang, channel: Channel): string {
  return lang === "bn" ? BN[channel] : EN[channel];
}
