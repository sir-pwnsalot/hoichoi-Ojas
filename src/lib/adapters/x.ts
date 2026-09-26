import { createAdapter } from "./base";

// Mock x adapter — rules live in specs.ts, byte-level checks in validate.ts.
export const xAdapter = createAdapter("x");
