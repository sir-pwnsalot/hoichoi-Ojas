import { connection } from "next/server";

// DB reads must render at request time, never at build (the build has no
// real DB). Outside Next (vitest, tsx scripts) there is no request scope,
// so that one case is a no-op; prerender bailouts still propagate.
export async function requestTime(): Promise<void> {
  try {
    await connection();
  } catch (err) {
    if (err instanceof Error && err.message.includes("outside a request scope")) return;
    throw err;
  }
}
