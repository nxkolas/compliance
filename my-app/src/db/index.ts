import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
let dbQueryObserver: ((query: string) => void) | undefined;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, {
  // Supabase transaction pooler does not support prepared statements.
  prepare: false,
  debug(_connection, query) {
    dbQueryObserver?.(query);
  },
});

export const db = drizzle({ client, schema });
export type Db = typeof db;

export function closeDbConnection() {
  return client.end();
}

export function setDbQueryObserver(observer?: (query: string) => void) {
  dbQueryObserver = observer;
}
