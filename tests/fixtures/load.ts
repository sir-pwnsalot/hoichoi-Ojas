import { readFileSync } from "node:fs";
import path from "node:path";

export const FIXTURE_DIR = path.resolve(__dirname);

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(FIXTURE_DIR, name)));
}
