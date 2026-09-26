"use client";

import { useEffect, useState } from "react";
import { getClock, getSpend } from "@/lib/actions";
import { Clock, DollarSign, FastForward } from "lucide-react";
import { Button } from "./ui/button";
import { advanceClock } from "@/lib/actions";

export function TopBar() {
  const [now, setNow] = useState<Date | null>(null);
  const [spend, setSpend] = useState<{ totalUsd: number; capUsd: number } | null>(null);

  const fetchState = async () => {
    const clock = await getClock();
    setNow(clock.now);
    const s = await getSpend();
    setSpend(s);
  };

  useEffect(() => {
    fetchState();
    const int = setInterval(fetchState, 5000);
    return () => clearInterval(int);
  }, []);

  const handleAdvance = async () => {
    await advanceClock(1000 * 60 * 60); // advance 1 hour
    fetchState();
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center text-sm text-zinc-400 gap-6">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {now ? now.toLocaleString() : "Loading..."}
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleAdvance}>
            <FastForward className="w-3 h-3 mr-1" /> Advance +1h
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {spend && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-zinc-400" />
            <span className="font-medium text-zinc-200">${spend.totalUsd.toFixed(2)}</span>
            <span className="text-zinc-500">/ ${spend.capUsd}</span>
          </div>
        )}
      </div>
    </header>
  );
}
