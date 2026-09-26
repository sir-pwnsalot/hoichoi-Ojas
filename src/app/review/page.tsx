import { listConcepts, listVariants } from "@/lib/actions";
import { ReviewClient } from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const concepts = await listConcepts("brief-mock");
  const variants = await listVariants({});
  
  // Inject test variants for Bengali typography
  const testConcept = { id: "test-c1", briefId: "b1", name: "Bengali Conjunct Test", coreIdea: "Test fonts", createdAt: new Date() };
  if (!concepts.find(c => c.id === "test-c1")) concepts.push(testConcept);
  
  const channels = ["instagram", "x", "youtube"] as const;
  channels.forEach((ch, idx) => {
    const id = `P-999${idx}`;
    if (!variants.find(v => v.id === id)) {
      variants.push({
        id,
        conceptId: "test-c1",
        channel: ch,
        lang: "bn",
        format: ch === "youtube" ? "video" : "image",
        caption: "রহস্যের স্বাদ, ক্ষণে ক্ষণে",
        hashtags: ["#test"],
        cta: "Watch now",
        hook: "রহস্যের স্বাদ, ক্ষণে ক্ষণে",
        planJson: null,
        imagePrompt: "test prompt",
        assetUrl: null,
        assetSha256: null,
        width: null,
        height: null,
        bytes: null,
        durationSec: null,
        criticJson: null,
        status: "draft",
        version: 1,
        parentId: null,
        discardNote: null,
        createdAt: new Date()
      });
    }
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Review & Schedule</h1>
          <p className="text-zinc-400">Review generated variants, edit copy, and approve for publishing.</p>
        </div>
      </div>
      
      <ReviewClient initialConcepts={concepts} initialVariants={variants} />
    </div>
  );
}
