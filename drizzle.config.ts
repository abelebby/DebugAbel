import type { Config } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// drizzle-kit does not honour "sslmode" from the connection string the way the
// app's pg pool does, so the URL is split into explicit credentials and the TLS
// setting is passed directly. The server (AWS RDS) requires encryption, and its
// certificate is signed by the Amazon RDS CA, which is not in Node's trust
// store - hence rejectUnauthorized: false rather than plain "true".
const url = new URL(process.env.DATABASE_URL);
const sslmode = url.searchParams.get("sslmode");

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: sslmode && sslmode !== "disable" ? { rejectUnauthorized: false } : false,
  },
} satisfies Config;
