import { db } from "@/src/db";
import { aiProcessingRuns, backgroundJobs } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { assertLiveParentForAiRun } from "./job-run-policy";

type AiProcessingRunInsert = typeof aiProcessingRuns.$inferInsert;

export async function createAiProcessingRunWithLiveJobGate(
  values: AiProcessingRunInsert,
  now = new Date(),
) {
  if (!values.jobId) {
    const [run] = await db.insert(aiProcessingRuns).values(values).returning();
    if (!run) throw new Error("AI processing run was not created");
    return run;
  }
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select({
        id: backgroundJobs.id,
        organizationId: backgroundJobs.organizationId,
        state: backgroundJobs.state,
        cancellationRequestedAt: backgroundJobs.cancellationRequestedAt,
        leaseOwner: backgroundJobs.leaseOwner,
        leaseExpiresAt: backgroundJobs.leaseExpiresAt,
      })
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, values.jobId!))
      .limit(1)
      .for("update");
    assertLiveParentForAiRun(parent, {
      now,
      organizationId: values.organizationId ?? null,
    });
    const [run] = await tx.insert(aiProcessingRuns).values(values).returning();
    if (!run) throw new Error("AI processing run was not created");
    return run;
  });
}
