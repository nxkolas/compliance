import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  actionPlans,
  aiProcessingRuns,
  apiRateLimitWindows,
  backgroundJobs,
  guestApplicabilityChecks,
  idempotencyRecords,
  organizationInvitations,
  reports,
  uploadSessions,
} from "@/src/db/schema";
import { expireUploadSessions, listUnreferencedFailedUploads } from "@/src/server/uploads";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { expireStaleClientInference } from "@/src/server/ai/client-inference/service";
import { enqueueJob } from "@/src/server/jobs";

export async function cleanupExpiredApiPrimitives(now = new Date()) {
  return db.transaction(async (tx) => {
    const strandedAiRuns = await tx.update(aiProcessingRuns).set({
      status: "failed",
      failureCode: "GENERATION_JOB_TERMINAL",
      failureMessage: "The generation job ended before publication.",
      completedAt: now,
    }).where(and(
      eq(aiProcessingRuns.status, "processing"),
      sql`exists (
        select 1 from ${backgroundJobs}
        where ${backgroundJobs.id} = ${aiProcessingRuns.jobId}
          and ${backgroundJobs.state} in ('failed', 'cancelled')
      )`,
    )).returning({ id: aiProcessingRuns.id });
    const idempotency = await tx.delete(idempotencyRecords).where(lt(idempotencyRecords.expiresAt, now)).returning({ id: idempotencyRecords.id });
    const rateLimits = await tx.delete(apiRateLimitWindows).where(lt(apiRateLimitWindows.expiresAt, now)).returning({ key: apiRateLimitWindows.key });
    const guests = await tx.delete(guestApplicabilityChecks).where(lt(guestApplicabilityChecks.expiresAt, now)).returning({ id: guestApplicabilityChecks.id });
    const invitations = await tx.delete(organizationInvitations).where(lt(organizationInvitations.expiresAt, now)).returning({ id: organizationInvitations.id });
    const oldJobCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
    const jobs = await tx.delete(backgroundJobs).where(and(
      inArray(backgroundJobs.state, ["succeeded", "failed", "cancelled"]),
      lt(backgroundJobs.finishedAt, oldJobCutoff),
      sql`not exists (select 1 from ${actionPlans} where ${actionPlans.generationJobId} = ${backgroundJobs.id})`,
      sql`not exists (select 1 from ${reports} where ${reports.renderingJobId} = ${backgroundJobs.id})`,
    )).returning({ id: backgroundJobs.id });
    return {
      idempotencyRecords: idempotency.length,
      rateLimitWindows: rateLimits.length,
      guestApplicabilityChecks: guests.length,
      organizationInvitations: invitations.length,
      backgroundJobs: jobs.length,
      strandedAiProcessingRuns: strandedAiRuns.length,
    };
  });
}

export async function runMaintenanceCleanup(now = new Date()) {
  const api = await cleanupExpiredApiPrimitives(now);
  const expiredUploads = await expireUploadSessions(now);
  const abandonedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const candidates = await listUnreferencedFailedUploads(abandonedBefore);
  let removedObjects = 0;
  let removedSessions = 0;
  const storage = getSupabaseAdminClient().storage;
  for (const candidate of candidates) {
    const { error } = await storage.from(candidate.bucket).remove([candidate.objectPath]);
    if (error) continue;
    const deleted = await db.delete(uploadSessions).where(and(
      eq(uploadSessions.id, candidate.id),
      inArray(uploadSessions.state, ["expired", "failed"]),
    )).returning({ id: uploadSessions.id });
    if (deleted.length) {
      removedObjects += 1;
      removedSessions += 1;
    }
  }
  // Requests nobody's browser ever answered. Without this a job parked behind a
  // client that never came back waits for its own outer timeout instead of
  // failing with a reason the user can act on.
  const expiredClientInference = await expireStaleClientInference(now);
  return {
    ...api,
    expiredUploadSessions: expiredUploads.length,
    removedObjects,
    removedSessions,
    expiredClientInference,
  };
}

export async function ensureScheduledCleanupJob(runAfter = new Date(Date.now() + 24 * 60 * 60 * 1_000)) {
  return enqueueJob({
    kind: "maintenance_cleanup",
    payload: { version: 1 },
  }, { runAfter, onConflictDoNothing: true });
}
