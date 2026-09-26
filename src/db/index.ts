import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  // Vercel can inject an *empty string* env var (not undefined) when a
  // project env var exists but has no value set for this environment —
  // `??` doesn't catch that, so fall back explicitly on falsy.
  url: process.env.DATABASE_URL || "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
