import { listVariants, listPublishAttempts, getClock } from "@/lib/actions";
import { QueueClient } from "./QueueClient";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const variants = await listVariants({});
  const publishAttempts = await listPublishAttempts();
  const clock = await getClock();

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Publish Queue</h1>
        <p className="text-zinc-400">Schedule approved assets and monitor publish attempts.</p>
      </div>
      <QueueClient 
        initialVariants={variants} 
        initialAttempts={publishAttempts} 
        initialClock={clock} 
      />
    </div>
  );
}
