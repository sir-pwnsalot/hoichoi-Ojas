"use server";

import { randomUUID } from "node:crypto";
import type { Channel, ComparisonRow, Lang } from "@/lib/types";

// M0 stub: realistic mock data with the final shape. Wired to
// src/lib/analytics/compare.ts (normalised rates) in M5.

const CHANNELS: Channel[] = ["instagram", "x", "youtube"];
const LANGS: Lang[] = ["bn", "en"];

export async function getComparison(briefId?: string): Promise<ComparisonRow[]> {
  const conceptId = briefId ? `${briefId}-concept` : "concept-mock";
  return CHANNELS.flatMap((channel) =>
    LANGS.map((lang) => ({
      conceptId,
      conceptName: "Episode 5 launch",
      channel,
      lang,
      variantId: `P-${randomUUID().slice(0, 4)}`,
      engagementRate: channel === "youtube" ? 0.041 : 0.062,
      shareRate: 0.008,
      saveRate: channel === "instagram" ? 0.014 : 0.005,
      completionProxy: channel === "youtube" ? 0.47 : null,
      impressions: 12_400,
    })),
  );
}
