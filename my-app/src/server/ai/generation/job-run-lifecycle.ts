import { db } from "@/src/db";
import { aiProcessingRuns, backgroundJobs } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { assertLiveParentForAiRun } from "./job-run-policy";

type AiProcessingRunInsert = typeof aiProcessingRuns.$inferInsert;

export async function assertLiveParentJobForAiRun(input: {
  jobId: string;
  organizationId: string | null;
  expectedLeaseOwner: string;
  now?: Date;
}) {
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select({
        organizationId: backgroundJobs.organizationId,
        state: backgroundJobs.state,
        cancellationRequestedAt: backgroundJobs.cancellationRequestedAt,
        leaseOwner: backgroundJobs.leaseOwner,
        leaseExpiresAt: backgroundJobs.leaseExpiresAt,
      })
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, input.jobId))
      .limit(1)
      .for("update");
    assertLiveParentForAiRun(parent, {
      now: input.now ?? new Date(),
      organizationId: input.organizationId,
      expectedLeaseOwner: input.expectedLeaseOwner,
    });
  });
}

export async function createAiProcessingRunWithLiveJobGate(
  values: AiProcessingRunInsert,
  now = new Date(),
  expectedLeaseOwner?: string,
) {
  if (!values.jobId) {
    const [run] = await db.insert(aiProcessingRuns).values(values).returning();
    if (!run) throw new Error("AI processing run was not created");
    return run;
  }
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select({
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
      expectedLeaseOwner,
    });
    const [run] = await tx.insert(aiProcessingRuns).values(values).returning();
    if (!run) throw new Error("AI processing run was not created");
    return run;
  });
}
