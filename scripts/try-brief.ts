// Runs ONE Bengali brief through the real M1 pipeline (createBrief ->
// generateCampaign -> listVariants) and prints, per channel x language,
// the hook, char count, critic score and independence verdict.
//
// Usage: npm run try-brief
//
// Loaded lazily via dynamic import() so process.loadEnvFile() runs before
// src/db/index.ts reads DATABASE_URL/etc. at module init time.

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local missing is fine in CI; real keys must be present for this
  // script to do anything useful though.
}

async function main() {
  const { createBrief, generateCampaign, listVariants } = await import("../src/lib/actions");

  const brief = await createBrief({
    title: "Dhonyasha — Episode 5 launch",
    show: "ধোঁয়াশা",
    keyMessage:
      "উত্তর কলকাতার একটা চুপচাপ পাড়ায়, তালাবন্ধ বাড়ির দেওয়ালে রাতারাতি একটা হাতের ছাপ ফুটে ওঠে। এপিসোড ৫ থেকে জানা যাবে সেটা কার।",
    audience: "Bengali thriller fans, 20-40, Kolkata + diaspora",
    languages: ["bn", "en"],
    tone: "suspenseful, witty",
    ctaGoal: "drive watch-throughs on hoichoi",
    briefLang: "bn",
  });
  console.log(`brief: ${brief.id}\n`);

  await generateCampaign(brief.id);
  const variants = await listVariants({ briefId: brief.id });

  const channels = Array.from(new Set(variants.map((v) => v.channel)));
  for (const channel of channels) {
    const bn = variants.find((v) => v.channel === channel && v.lang === "bn");
    const en = variants.find((v) => v.channel === channel && v.lang === "en");
    const isTranslation = (bn?.criticJson as { isTranslation?: boolean } | null)?.isTranslation;
    const verdict = isTranslation === undefined ? "n/a" : isTranslation ? "TRANSLATION-LIKE ⚠" : "independent ✅";

    for (const v of [bn, en]) {
      if (!v) continue;
      const score = (v.criticJson as { score?: number } | null)?.score ?? "—";
      console.log(
        `${channel.padEnd(9)} ${v.lang}  hook: "${v.hook}"  chars: ${v.caption.length}  critic: ${score}  independence: ${verdict}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
