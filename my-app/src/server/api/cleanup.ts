import { db } from "@/src/db";
import {
  apiRateLimitWindows,
  backgroundJobs,
  idempotencyRecords,
  uploadSessionResults,
  uploadSessions,
} from "@/src/db/schema";
import { and, eq, inArray, lt, notExists } from "drizzle-orm";
import {
  expireUploadSessions,
  listUnreferencedFailedUploads,
} from "@/src/server/uploads";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import {
  readGenerationLifecycleInvariants,
  reconcileTerminalParentProcessingRuns,
} from "@/src/server/jobs";
import { emitGenerationMetric } from "@/src/server/ai/generation/metrics";

export async function cleanupExpiredApiPrimitives(now = new Date()) {
  return db.transaction(async (tx) => {
    const idempotency = await tx
      .delete(idempotencyRecords)
      .where(lt(idempotencyRecords.expiresAt, now))
      .returning({ id: idempotencyRecords.id });
    const rateLimits = await tx
      .delete(apiRateLimitWindows)
      .where(lt(apiRateLimitWindows.expiresAt, now))
      .returning({ key: apiRateLimitWindows.key });
    return {
      idempotencyRecords: idempotency.length,
      rateLimitWindows: rateLimits.length,
    };
  });
}

export async function runMaintenanceCleanup(now = new Date()) {
  const generationReconciliation = await reconcileTerminalParentProcessingRuns({
    now,
    limit: 100,
  });
  for (const [state, count] of Object.entries(
    generationReconciliation.changedByParentState,
  )) {
    if (count > 0) {
      emitGenerationMetric({
        name: "orphan_runs_reconciled",
        value: count,
        state,
      });
    }
  }
  const generationInvariants = await readGenerationLifecycleInvariants();
  if (
    generationInvariants.terminalJobsWithProcessingRuns > 0 ||
    generationInvariants.categoryDiagnosticsAfterParentFinished > 0
  ) {
    console.error("Generation lifecycle invariant violation", {
      ...generationInvariants,
    });
  }
  const api = await cleanupExpiredApiPrimitives(now);
  const expiredUploads = await expireUploadSessions(now);
  const abandonedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const abandonedVerified = await db
    .update(uploadSessions)
    .set({
      state: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(uploadSessions.state, "verified"),
        lt(uploadSessions.expiresAt, abandonedBefore),
        notExists(
          db
            .select({ sessionId: uploadSessionResults.sessionId })
            .from(uploadSessionResults)
            .where(eq(uploadSessionResults.sessionId, uploadSessions.id)),
        ),
      ),
    )
    .returning({ id: uploadSessions.id });
  const candidates = await listUnreferencedFailedUploads(abandonedBefore);
  let removedObjects = 0;
  let removedSessions = 0;
  const storage = getSupabaseAdminClient().storage;
  for (const candidate of candidates) {
    const { error } = await storage
      .from(candidate.bucket)
      .remove([candidate.objectPath]);
    if (error) continue;
    const deleted = await db
      .delete(uploadSessions)
      .where(
        and(
          eq(uploadSessions.id, candidate.id),
          inArray(uploadSessions.state, ["expired", "failed"]),
          notExists(
            db
              .select({ sessionId: uploadSessionResults.sessionId })
              .from(uploadSessionResults)
              .where(eq(uploadSessionResults.sessionId, uploadSessions.id)),
          ),
        ),
      )
      .returning({ id: uploadSessions.id });
    if (deleted.length) {
      removedObjects += 1;
      removedSessions += 1;
    }
  }
  return {
    generationOrphanRunsReconciled: generationReconciliation.changed,
    generationOrphanRunsByParentState:
      generationReconciliation.changedByParentState,
    generationInvariants,
    ...api,
    expiredUploadSessions: expiredUploads.length,
    abandonedVerifiedUploads: abandonedVerified.length,
    removedObjects,
    removedSessions,
  };
}

export async function ensureScheduledCleanupJob(
  runAfter = new Date(Date.now() + 24 * 60 * 60 * 1_000),
) {
  const [job] = await db
    .insert(backgroundJobs)
    .values({
      kind: "cleanup",
      payload: { version: 1 },
      cancellable: false,
      maxAttempts: 3,
      runAfter,
    })
    .onConflictDoNothing()
    .returning();
  return job ?? null;
}
