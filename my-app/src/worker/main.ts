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
    { drainPortableJobs },
  ] = await Promise.all([
    import("@/src/server/database-lifecycle"),
    import("@/src/server/job-execution"),
  ]);

  try {
    while (!draining) {
      const controller = new AbortController();
      const stop = () => controller.abort("resident_worker_shutdown");
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, stop);
      }
      const result = await drainPortableJobs({
        invocationId: workerId,
        adapter: "resident_worker",
        maxJobs: once ? 1 : 100,
        deadline: new Date(Date.now() + 4 * 60 * 1000),
        signal: controller.signal,
        abortStopReason: "graceful_shutdown",
      });
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.off(signal, stop);
      }
      if (once || draining) break;
      if (result.claimed === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
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
