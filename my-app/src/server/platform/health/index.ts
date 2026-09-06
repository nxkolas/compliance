import { sql } from "drizzle-orm";
import { db } from "@/src/db";

const readinessTimeoutMilliseconds = 3_000;

export async function checkDatabaseReadiness() {
  return withTimeout(
    db.execute(sql`select 1 as ready`),
    readinessTimeoutMilliseconds,
  );
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMilliseconds: number,
) {
  let timeout: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error("Readiness check timed out")),
      timeoutMilliseconds,
    );
    timeout.unref();
  });

  try {
    return await Promise.race([operation, expired]);
  } finally {
    clearTimeout(timeout);
  }
}
