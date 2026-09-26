import { createAdapter } from "./base";

// Mock youtube adapter — rules live in specs.ts, byte-level checks in validate.ts.
export const youtubeAdapter = createAdapter("youtube");
