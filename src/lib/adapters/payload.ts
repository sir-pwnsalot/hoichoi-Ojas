import type { Variant } from "@/lib/types";
import type { PublishPayload } from "./types";

// The exact text that would be posted: caption plus any hashtags not already
// in it. Limits are then counted on this final text, never on the array.
export function finalCaption(caption: string, hashtags: string[]): string {
  const missing = hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .filter((h) => !caption.includes(h));
  return missing.length ? `${caption.trimEnd()}\n\n${missing.join(" ")}` : caption;
}

export function payloadForVariant(v: Variant): PublishPayload {
  return {
    variantId: v.id,
    caption: finalCaption(v.caption, v.hashtags),
    title: v.channel === "youtube" ? v.hook : undefined, // Shorts title = hook (channel rules)
    hashtags: v.hashtags,
    asset: { url: v.assetUrl ?? "" },
    source: "scheduler",
  };
}
