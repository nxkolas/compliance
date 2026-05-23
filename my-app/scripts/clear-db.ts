import "dotenv/config";

import { reset } from "drizzle-seed";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to clear production DB");
}

if (process.env.DB_CLEAR_CONFIRM !== "clear-app-tables") {
  throw new Error(
    "Refusing to clear DB without DB_CLEAR_CONFIRM=clear-app-tables",
  );
}

const client = postgres(databaseUrl, {
  prepare: false,
});
const db = drizzle(client);

async function main() {
  try {
    await reset(db, schema);
    console.log("Cleared Drizzle-managed app tables.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
