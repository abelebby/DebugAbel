/**
 * Applies the SQL in ./drizzle without needing CREATE-on-database privilege.
 *
 * drizzle-kit/drizzle-orm unconditionally run `CREATE SCHEMA IF NOT EXISTS
 * "drizzle"` to hold their bookkeeping table, which requires CREATE on the
 * DATABASE. This role only has CREATE on the "public" SCHEMA, so that call
 * fails with 42501. This script keeps the same journal format but puts the
 * bookkeeping table in "public", where the role is allowed to create it.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env", quiet: true });

const TABLE = "__drizzle_migrations";
const journal = JSON.parse(await readFile("./drizzle/meta/_journal.json", "utf8"));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "public"."${TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )`);

  const { rows } = await client.query(`SELECT hash FROM "public"."${TABLE}"`);
  const applied = new Set(rows.map((r) => r.hash));

  let count = 0;
  for (const entry of journal.entries) {
    const sql = await readFile(`./drizzle/${entry.tag}.sql`, "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");

    if (applied.has(hash)) {
      console.log(`= ${entry.tag} (already applied)`);
      continue;
    }

    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    await client.query("BEGIN");
    try {
      for (const statement of statements) await client.query(statement);
      await client.query(
        `INSERT INTO "public"."${TABLE}" (hash, created_at) VALUES ($1, $2)`,
        [hash, entry.when],
      );
      await client.query("COMMIT");
      console.log(`+ ${entry.tag} (${statements.length} statements)`);
      count++;
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`\nFAILED on ${entry.tag}`);
      console.error("  code   :", e.code);
      console.error("  message:", e.message);
      if (e.detail) console.error("  detail :", e.detail);
      if (e.hint) console.error("  hint   :", e.hint);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log(`\nDone. ${count} migration(s) applied.`);
} finally {
  client.release();
  await pool.end();
}
