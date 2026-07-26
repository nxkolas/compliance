import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { relations } from "./relations";

const connectionString = process.env.DATABASE_URL;
let dbQueryObserver: ((query: string) => void) | undefined;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const configuredPoolMax = process.env.DATABASE_POOL_MAX;
const poolMax = configuredPoolMax ? Number(configuredPoolMax) : 10;
if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 100) {
  throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 100");
}
const configuredIdleTimeout = process.env.DATABASE_POOL_IDLE_TIMEOUT_SECONDS;
const idleTimeoutSeconds = configuredIdleTimeout
  ? Number(configuredIdleTimeout)
  : 20;
if (
  !Number.isInteger(idleTimeoutSeconds) ||
  idleTimeoutSeconds < 1 ||
  idleTimeoutSeconds > 3_600
) {
  throw new Error(
    "DATABASE_POOL_IDLE_TIMEOUT_SECONDS must be an integer between 1 and 3600",
  );
}

const client = postgres(connectionString, {
  // Supabase transaction pooler does not support prepared statements.
  prepare: false,
  max: poolMax,
  idle_timeout: idleTimeoutSeconds,
  debug(_connection, query) {
    dbQueryObserver?.(query);
  },
});

export const db = drizzle({ client, relations });
export type Db = typeof db;

export function closeDbConnection() {
  return client.end();
}

export function setDbQueryObserver(observer?: (query: string) => void) {
  dbQueryObserver = observer;
}
