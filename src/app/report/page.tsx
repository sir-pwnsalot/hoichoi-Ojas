import { getLatestReport, listInsights } from "@/lib/actions";
import { ReportClient } from "./ReportClient";

export default async function ReportPage() {
  const latestReport = await getLatestReport();
  const insights = await listInsights(true);

  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Weekly Report</h1>
        <p className="text-zinc-400 text-sm">
          Generate data-driven performance reports and extract actionable insights for future campaigns.
        </p>
      </div>
      
      <ReportClient 
        initialReport={latestReport} 
        initialInsights={insights} 
      />
    </div>
  );
}
