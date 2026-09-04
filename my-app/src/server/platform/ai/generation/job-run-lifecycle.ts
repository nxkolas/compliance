import { db } from "@/src/db";
import { aiProcessingRuns, backgroundJobs } from "@/src/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
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
  const jobId = values.jobId;
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
      .where(eq(backgroundJobs.id, jobId))
      .limit(1)
      .for("update");
    assertLiveParentForAiRun(parent, {
      now,
      organizationId: values.organizationId ?? null,
      expectedLeaseOwner,
    });
    if (
      typeof values.generationReservationKey === "string" &&
      typeof values.idempotencyKey === "string" &&
      typeof values.organizationId === "string"
    ) {
      await tx
        .update(aiProcessingRuns)
        .set({
          status: "failed",
          failureCode: "GENERATION_ATTEMPT_ABANDONED",
          failureMessage:
            "A live successor attempt replaced this unfinished provider call.",
          completedAt: now,
        })
        .where(
          and(
            eq(aiProcessingRuns.jobId, jobId),
            eq(aiProcessingRuns.organizationId, values.organizationId),
            eq(aiProcessingRuns.operationKind, values.operationKind),
            eq(
              aiProcessingRuns.generationReservationKey,
              values.generationReservationKey,
            ),
            ne(aiProcessingRuns.idempotencyKey, values.idempotencyKey),
            eq(aiProcessingRuns.status, "processing"),
            isNull(aiProcessingRuns.validatedOutput),
          ),
        );
    }
    const [run] = await tx.insert(aiProcessingRuns).values(values).returning();
    if (!run) throw new Error("AI processing run was not created");
    return run;
  });
}
