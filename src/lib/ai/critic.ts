import { generateJSON } from "@/lib/ai/llm";
import { generateCopy } from "@/lib/ai/copy";
import { criticRawSchema, CRITIC_SYSTEM_PROMPT, buildCriticUserPrompt, type CriticRaw } from "@/lib/ai/prompts/critic";
import { independenceSchema, INDEPENDENCE_SYSTEM_PROMPT, buildIndependenceUserPrompt } from "@/lib/ai/prompts/independence";
import type { CopyResult } from "@/lib/ai/prompts/copy-schema";
import type { Brief, Channel, CreativePlan, CriticResult } from "@/lib/types";

export async function runNativenessCritic(bnCopy: CopyResult): Promise<CriticRaw> {
  return generateJSON({
    purpose: "critic",
    system: CRITIC_SYSTEM_PROMPT,
    user: buildCriticUserPrompt(bnCopy),
    schema: criticRawSchema,
    temperature: 0.3,
  });
}

export async function runIndependenceCheck(bnText: string, enText: string) {
  return generateJSON({
    purpose: "critic",
    system: INDEPENDENCE_SYSTEM_PROMPT,
    user: buildIndependenceUserPrompt(bnText, enText),
    schema: independenceSchema,
    temperature: 0.1,
  });
}

// Generates the bn copy, critiques it, and — if the nativeness score is
// below 4 — regenerates once with the critic's flags folded in as notes,
// keeping whichever of the two attempts scored higher (non-negotiable #2).
export async function generateBnCopyWithCritic(args: {
  channel: Channel;
  brief: Brief;
  plan: CreativePlan;
}): Promise<{ copy: CopyResult; critic: CriticRaw }> {
  const { channel, brief, plan } = args;
  let copy = await generateCopy({ lang: "bn", channel, brief, plan });
  let critic = await runNativenessCritic(copy);

  if (critic.score < 4) {
    const notes = critic.flags
      .map((f) => `"${f.phrase}" — ${f.why}. Try instead: "${f.rewrite}"`)
      .join("\n");
    const regenCopy = await generateCopy({ lang: "bn", channel, brief, plan, notes });
    const regenCritic = await runNativenessCritic(regenCopy);
    if (regenCritic.score >= critic.score) {
      copy = regenCopy;
      critic = regenCritic;
    }
  }

  return { copy, critic };
}

// Folds the nativeness critic + independence judge (bn vs en, non-negotiable
// #2's "not a translation" check) into the single CriticResult persisted on
// the bn variant.
export async function buildCriticResult(
  critic: CriticRaw,
  bnCaption: string,
  enCaption: string,
): Promise<CriticResult> {
  const independence = await runIndependenceCheck(bnCaption, enCaption);
  return {
    score: critic.score,
    isTranslation: independence.isTranslation,
    flaggedPhrases: critic.flags.map((f) => `${f.phrase} — ${f.why}`),
    notes: `${critic.verdict} (${critic.register}); independence: ${independence.reason}`,
  };
}
