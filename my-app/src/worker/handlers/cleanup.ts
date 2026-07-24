import type { BackgroundJobRecord } from "@/src/server/jobs";
import { runMaintenanceCleanup } from "@/src/server/api/cleanup";

export async function handleCleanup(job: BackgroundJobRecord) {
  await runMaintenanceCleanup();
  void job;
  return undefined;
}
