// M4 pre-migration for publish_attempts (idempotent). drizzle-kit's SQLite
// table recreation (needed because variant_id became nullable) copies the new
// columns before they exist and fails with "no such column: channel". Adding
// them first makes the following `npm run db:push` succeed.
// Usage: npx tsx --env-file=.env.local scripts/migrate-m4.ts && npm run db:push
import { createClient } from "@libsql/client";

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  const cols = await client.execute("PRAGMA table_info(publish_attempts)");
  const have = new Set(cols.rows.map((r) => String(r.name)));
  if (have.size === 0) return console.log("publish_attempts missing — plain db:push will create it");
  if (!have.has("channel")) await client.execute("ALTER TABLE publish_attempts ADD COLUMN channel text DEFAULT '' NOT NULL");
  if (!have.has("source")) await client.execute("ALTER TABLE publish_attempts ADD COLUMN source text DEFAULT 'scheduler' NOT NULL");
  console.log("publish_attempts: channel/source present");
}

main();
