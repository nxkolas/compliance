import "dotenv/config";
import { sql } from "drizzle-orm";
import { getWorkerEnvironment } from "@/src/config/env/worker";

async function main() {
  getWorkerEnvironment();
  const [{ db }, { closeDatabaseConnection }] = await Promise.all([
    import("@/src/db"),
    import("@/src/server/database-lifecycle"),
  ]);

  try {
    await Promise.race([
      db.execute(sql`select 1 as ready`),
      new Promise<never>((_resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Worker database readiness timed out")),
          3_000,
        );
        timeout.unref();
      }),
    ]);
  } finally {
    await closeDatabaseConnection();
  }
}

main().catch((error) => {
  console.error("Worker is not ready", {
    errorType: error instanceof Error ? error.name : "unknown",
  });
  process.exitCode = 1;
});
