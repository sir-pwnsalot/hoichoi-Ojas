import { listConcepts, listVariants } from "@/lib/actions";
import { ReviewClient } from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const concepts = await listConcepts();
  const variants = await listVariants({});

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
