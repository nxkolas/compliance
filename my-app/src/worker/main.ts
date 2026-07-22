import "dotenv/config";
import { randomUUID } from "node:crypto";
import { closeDbConnection } from "@/src/db";
import { runOneJob } from "./runtime";
import { ensureScheduledCleanupJob } from "@/src/server/api/cleanup";
import { ensureScheduledLegalSourceMonitorJobs } from "@/src/server/corpus/monitor-scheduler";

const once = process.argv.includes("--once");
const workerId = process.env.WORKER_ID ?? `worker-${randomUUID()}`;

async function main() {
  await ensureScheduledCleanupJob();
  await ensureScheduledLegalSourceMonitorJobs();
  do {
    const worked = await runOneJob(workerId);
    if (once) return;
    if (!worked) await new Promise((resolve) => setTimeout(resolve, 1_000));
  } while (true);
}

main()
  .catch((error) => {
    console.error("Worker stopped", { errorType: error instanceof Error ? error.name : "unknown" });
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
