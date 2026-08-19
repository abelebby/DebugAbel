import { config } from "dotenv";
import pg from "pg";
config({ path: ".env", quiet: true });

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const one = async (sql) => (await c.query(sql)).rows;

console.log("=== which server am I actually on? ===");
console.table(await one(`
  select current_database() as database,
         current_user as "user",
         inet_server_addr()::text as server_ip,
         inet_server_port() as port,
         current_schema() as schema`));

console.log("\n=== every table this role can see, with owner and schema ===");
console.table(await one(`
  select schemaname as schema, tablename as table, tableowner as owner
  from pg_tables
  where schemaname not in ('pg_catalog','information_schema')
  order by schemaname, tablename`));

console.log("\n=== row counts ===");
const tables = await one(`
  select table_schema, table_name from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE' order by table_name`);
for (const t of tables) {
  const n = await one(`select count(*)::int as n from "${t.table_schema}"."${t.table_name}"`);
  console.log(`  ${t.table_schema}.${t.table_name}: ${n[0].n} rows`);
}

console.log("\n=== projects (the rows you created) ===");
console.table(await one(`select id, name, created_at from projects order by created_at`));

console.log("\n=== search_path ===");
console.table(await one(`show search_path`));

await c.end();
