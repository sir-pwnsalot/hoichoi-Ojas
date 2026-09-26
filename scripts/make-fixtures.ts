// Dev-only: writes tests/fixtures/* from tests/fixtures/manifest.ts.
// Usage: npm run fixtures [-- --force]
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FIXTURES } from "../tests/fixtures/manifest";

export async function makeFixtures(force = false): Promise<string[]> {
  const dir = path.resolve(__dirname, "../tests/fixtures");
  const written: string[] = [];
  for (const [name, make] of Object.entries(FIXTURES)) {
    const file = path.join(dir, name);
    if (!force && existsSync(file)) continue;
    writeFileSync(file, await make());
    written.push(name);
  }
  return written;
}

if (process.argv[1]?.includes("make-fixtures")) {
  makeFixtures(process.argv.includes("--force")).then((w) => console.log(`fixtures written: ${w.join(", ") || "(none)"}`));
}
