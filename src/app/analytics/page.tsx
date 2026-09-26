import { listConcepts, getComparison } from "@/lib/actions";
import { AnalyticsClient } from "./AnalyticsClient";

export const metadata = {
  title: "Analytics | Studio",
};

export default async function AnalyticsPage() {
  const briefId = "brief-mock";
  const concepts = await listConcepts(briefId);
  const data = await getComparison(briefId);

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-muted/10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaign Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Cross-channel performance, engagement rates, and insights.
          </p>
        </div>

        <AnalyticsClient concepts={concepts} initialData={data} />
      </div>
    </main>
  );
}
