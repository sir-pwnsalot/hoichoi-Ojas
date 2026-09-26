"use server";

import * as domainClock from "@/lib/domain/clock";
import { runSchedulerTick, type TickResult } from "@/lib/domain/scheduler";
import type { ClockState } from "@/lib/types";

// app_clock is a single-row table and the domain layer is the source of
// truth for "now" in the demo.

export async function getClock(): Promise<ClockState> {
  const offsetMs = await domainClock.getClockOffsetMs();
  return { offsetMs, now: new Date(Date.now() + offsetMs) };
}

// "⏩ advance clock": pass a preset ("+6h" | "+1d" | "+7d") or raw ms; the
// scheduler then ticks so anything now due gets published (or rejected).
export async function advanceClock(
  delta: number | domainClock.ClockPreset,
): Promise<ClockState & { tick: TickResult }> {
  const deltaMs = typeof delta === "number" ? delta : domainClock.CLOCK_PRESETS[delta];
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) throw new Error(`Invalid clock advance: ${String(delta)}`);
  const now = await domainClock.advanceClock(deltaMs);
  const offsetMs = await domainClock.getClockOffsetMs();
  const tick = await runSchedulerTick();
  return { offsetMs, now, tick };
}
