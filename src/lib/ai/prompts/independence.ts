import { z } from "zod";

export const independenceSchema = z.object({
  isTranslation: z.boolean(),
  reason: z.string().min(1),
});

export type IndependenceResult = z.infer<typeof independenceSchema>;

export const INDEPENDENCE_SYSTEM_PROMPT = `Given text A (Bengali) and text B (English) for the same campaign, decide if one is a translation of the other
(same hook, same sentence structure, same ordering of ideas). Return JSON: {"isTranslation":bool,"reason":string}`;

export function buildIndependenceUserPrompt(bnText: string, enText: string): string {
  return `Text A (Bengali): ${bnText}
Text B (English): ${enText}

Are these a translation of each other?`;
}
