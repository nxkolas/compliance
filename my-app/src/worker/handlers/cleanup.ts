import type { backgroundJobs } from "@/src/db/schema";
import { runMaintenanceCleanup } from "@/src/server/api/cleanup";

export async function handleCleanup(job: typeof backgroundJobs.$inferSelect) {
  await runMaintenanceCleanup();
  return { type: "maintenance_cleanup", id: job.id };
}
