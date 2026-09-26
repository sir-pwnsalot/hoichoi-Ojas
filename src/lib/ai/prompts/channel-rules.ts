import type { Channel } from "@/lib/types";

// Short natural-language description of each channel's spec, embedded in
// every plan/copy prompt so the model targets the right length and CTA
// style. The adapter's byte-level validate() (M4) is the actual authority —
// this just steers generation toward passing it on the first try.
export function channelRulesText(channel: Channel): string {
  switch (channel) {
    case "instagram":
      return "Feed image, 4:5. Hook ≤125 characters (shown before \"more\"). Caption 150–400 characters total. 3–5 hashtags. CTA: comment question or tag-a-friend.";
    case "x":
      return "Single post, target ≤200 weighted characters (hard limit 280). 1–2 hashtags. CTA: reply or quote-post. One sharp line, no lower-third overlay.";
    case "youtube":
      return "Shorts video, 9:16, 8–12s. Title ≤100 characters (goes in \"hook\"). Short description (goes in \"caption\"). 2–3 hashtags including #Shorts. CTA: watch full series / subscribe.";
  }
}
