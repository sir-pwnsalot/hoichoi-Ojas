import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { makeFixtures } from "../../scripts/make-fixtures";

// Fresh throwaway DB per run (vitest.config sets DATABASE_URL to it) with the
// real schema pushed, plus any missing binary fixtures.
export const TEST_DB = path.resolve(__dirname, "../../.test.db");

export default async function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(TEST_DB + suffix, { force: true });
  execSync("npx drizzle-kit push --force", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:.test.db" },
  });
  await makeFixtures();
}
