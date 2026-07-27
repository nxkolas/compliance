import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { relations } from "./relations";

const connectionString = process.env.DATABASE_URL;
let dbQueryObserver: ((query: string) => void) | undefined;
const globalForDb = globalThis as typeof globalThis & {
  __complyPostgresClient?: ReturnType<typeof postgres>;
};

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const maxConnections = Number.parseInt(
  process.env.POSTGRES_MAX_CONNECTIONS ??
    (process.env.NODE_ENV === "production" ? "5" : "1"),
  10,
);

const client =
  globalForDb.__complyPostgresClient ??
  postgres(connectionString, {
  // Supabase transaction pooler does not support prepared statements.
    prepare: false,
    max: Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : 1,
    idle_timeout: 20,
    debug(_connection, query) {
      dbQueryObserver?.(query);
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__complyPostgresClient = client;
}

export const db = drizzle({ client, relations });
export type Db = typeof db;

export function closeDbConnection() {
  return client.end();
}

export function setDbQueryObserver(observer?: (query: string) => void) {
  dbQueryObserver = observer;
}
