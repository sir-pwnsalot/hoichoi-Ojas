import { listInsights } from "@/lib/actions";
import { InsightsClient } from "./InsightsClient";

export default async function InsightsPage() {
  const insights = await listInsights(false); // fetch all insights

  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <span className="text-yellow-500">Knowledge Base</span>
        </h1>
        <p className="text-zinc-400 text-sm">
          Review and manage extracted insights. Active insights are automatically suggested during brief creation.
        </p>
      </div>
      
      <InsightsClient initialInsights={insights} />
    </div>
  );
}
