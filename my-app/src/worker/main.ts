import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getWorkerEnvironment } from "@/src/config/env/worker";

const once = process.argv.includes("--once");
const environment = getWorkerEnvironment();
const workerId = environment.WORKER_ID ?? `worker-${randomUUID()}`;
let draining = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    draining = true;
    console.info("Worker drain requested", { signal });
  });
}

async function main() {
  const [
    { closeDatabaseConnection },
    { runOneJob },
    { ensureScheduledCleanupJob },
    { ensureScheduledLegalSourceMonitorJobs },
  ] = await Promise.all([
    import("@/src/server/database-lifecycle"),
    import("./runtime"),
    import("@/src/server/api/cleanup"),
    import("@/src/server/corpus"),
  ]);

  try {
    await ensureScheduledCleanupJob();
    await ensureScheduledLegalSourceMonitorJobs();
    while (!draining) {
      const worked = await runOneJob(workerId);
      if (once || draining) break;
      if (!worked) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  } finally {
    await closeDatabaseConnection();
  }
}

main().catch((error) => {
  console.error("Worker stopped", {
    errorType: error instanceof Error ? error.name : "unknown",
  });
  process.exitCode = 1;
});
