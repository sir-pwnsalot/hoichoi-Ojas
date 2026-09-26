"use server";

import * as domainClock from "@/lib/domain/clock";
import type { ClockState } from "@/lib/types";

// Wired for real (not mocked): app_clock is a single-row table and the
// domain layer is already the source of truth for "now" in the demo.

export async function getClock(): Promise<ClockState> {
  const offsetMs = await domainClock.getClockOffsetMs();
  return { offsetMs, now: new Date(Date.now() + offsetMs) };
}

export async function advanceClock(deltaMs: number): Promise<ClockState> {
  const now = await domainClock.advanceClock(deltaMs);
  const offsetMs = await domainClock.getClockOffsetMs();
  return { offsetMs, now };
}
