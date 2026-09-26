import { generateJSON } from "@/lib/ai/llm";
import { copySchema, type CopyResult } from "@/lib/ai/prompts/copy-schema";
import { bnSystemPrompt, buildBnUserPrompt, pickAddress } from "@/lib/ai/prompts/copy-bn";
import { enSystemPrompt, buildEnUserPrompt } from "@/lib/ai/prompts/copy-en";
import type { Brief, Channel, CreativePlan, Lang } from "@/lib/types";

export type { CopyResult } from "@/lib/ai/prompts/copy-schema";

// One independent call per (channel x language). The bn call never sees the
// en output and vice versa — non-negotiable #2 (native Bengali). `notes` is
// used only for the one allowed critic-driven regeneration.
export async function generateCopy(args: {
  lang: Lang;
  channel: Channel;
  brief: Brief;
  plan: CreativePlan;
  notes?: string;
}): Promise<CopyResult> {
  const { lang, channel, brief, plan, notes } = args;
  if (lang === "bn") {
    const address = pickAddress(brief);
    return generateJSON({
      purpose: "copy",
      system: bnSystemPrompt(channel, address),
      user: buildBnUserPrompt({ brief, plan, channel, notes }),
      schema: copySchema,
      temperature: 0.9,
    });
  }
  return generateJSON({
    purpose: "copy",
    system: enSystemPrompt(channel),
    user: buildEnUserPrompt({ brief, plan, channel, notes }),
    schema: copySchema,
    temperature: 0.9,
  });
}
