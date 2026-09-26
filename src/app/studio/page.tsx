import { listInsights } from "@/lib/actions";
import { StudioClient } from "./StudioClient";

export default async function StudioPage() {
  const insights = await listInsights();
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Content Studio</h1>
        <p className="text-zinc-400">Generate per-channel creative plans and assets from a single brief.</p>
      </div>
      
      <StudioClient initialInsights={insights} />
    </div>
  );
}
