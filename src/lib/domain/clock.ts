import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appClock } from "@/db/schema";

const CLOCK_ID = 1;

// "⏩ advance clock" demo control presets.
export const CLOCK_PRESETS = {
  "+6h": 6 * 3600_000,
  "+1d": 24 * 3600_000,
  "+7d": 7 * 24 * 3600_000,
} as const;
export type ClockPreset = keyof typeof CLOCK_PRESETS;

export async function getClockOffsetMs(): Promise<number> {
  const rows = await db.select().from(appClock).where(eq(appClock.id, CLOCK_ID));
  return rows[0]?.offsetMs ?? 0;
}

export async function setClockOffsetMs(offsetMs: number): Promise<void> {
  await db
    .insert(appClock)
    .values({ id: CLOCK_ID, offsetMs })
    .onConflictDoUpdate({ target: appClock.id, set: { offsetMs } });
}

// The demo's notion of "now" — real time plus whatever the "advance clock"
// control has accumulated in app_clock.offsetMs.
export async function now(): Promise<Date> {
  const offset = await getClockOffsetMs();
  return new Date(Date.now() + offset);
}

export async function advanceClock(deltaMs: number): Promise<Date> {
  const current = await getClockOffsetMs();
  await setClockOffsetMs(current + deltaMs);
  return now();
}
