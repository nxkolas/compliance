import { db } from "@/src/db";
import { aiProcessingRuns, auditEvents, backgroundJobs } from "@/src/db/schema";
import { and, eq, gt, inArray, sql } from "drizzle-orm";

const TERMINAL_JOB_STATES = ["failed", "cancelled", "succeeded"] as const;

export type OrphanAiRunCandidate = {
  runId: string;
  parentJobId: string;
  parentState: (typeof TERMINAL_JOB_STATES)[number];
  runCreatedAt: Date;
  parentFinishedAt: Date | null;
  proposedSafeCode: "PARENT_JOB_CANCELLED" | "PARENT_JOB_TERMINATED";
};

export async function listTerminalParentProcessingRuns(limit = 100) {
  const boundedLimit = Math.max(1, Math.min(1_000, Math.trunc(limit)));
  const rows = await db
    .select({
      runId: aiProcessingRuns.id,
      parentJobId: backgroundJobs.id,
      parentState: backgroundJobs.state,
      runCreatedAt: aiProcessingRuns.createdAt,
      parentFinishedAt: backgroundJobs.finishedAt,
    })
    .from(aiProcessingRuns)
    .innerJoin(backgroundJobs, eq(backgroundJobs.id, aiProcessingRuns.jobId))
    .where(
      and(
        eq(aiProcessingRuns.status, "processing"),
        inArray(backgroundJobs.state, [...TERMINAL_JOB_STATES]),
      ),
    )
    .orderBy(aiProcessingRuns.createdAt, aiProcessingRuns.id)
    .limit(boundedLimit);
  return rows.map(toCandidate);
}

export async function reconcileTerminalParentProcessingRuns(
  input: {
    limit?: number;
    now?: Date;
    parentJobIds?: string[];
    runIds?: string[];
  } = {},
) {
  const limit = Math.max(1, Math.min(1_000, Math.trunc(input.limit ?? 100)));
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        runId: aiProcessingRuns.id,
        parentJobId: backgroundJobs.id,
        parentState: backgroundJobs.state,
        organizationId: backgroundJobs.organizationId,
        runCreatedAt: aiProcessingRuns.createdAt,
        parentFinishedAt: backgroundJobs.finishedAt,
      })
      .from(aiProcessingRuns)
      .innerJoin(backgroundJobs, eq(backgroundJobs.id, aiProcessingRuns.jobId))
      .where(
        and(
          eq(aiProcessingRuns.status, "processing"),
          inArray(backgroundJobs.state, [...TERMINAL_JOB_STATES]),
          input.parentJobIds?.length
            ? inArray(backgroundJobs.id, input.parentJobIds)
            : undefined,
          input.runIds
            ? input.runIds.length > 0
              ? inArray(aiProcessingRuns.id, input.runIds)
              : sql`false`
            : undefined,
        ),
      )
      .orderBy(aiProcessingRuns.createdAt, aiProcessingRuns.id)
      .limit(limit)
      .for("update", { skipLocked: true });

    const changed: OrphanAiRunCandidate[] = [];
    for (const row of rows) {
      const candidate = toCandidate(row);
      const [updated] = await tx
        .update(aiProcessingRuns)
        .set({
          status: "failed",
          errorCode: candidate.proposedSafeCode,
          errorMessage:
            "The parent background job terminated before this run settled.",
          completedAt: now,
        })
        .where(
          and(
            eq(aiProcessingRuns.id, row.runId),
            eq(aiProcessingRuns.status, "processing"),
          ),
        )
        .returning({ id: aiProcessingRuns.id });
      if (updated) changed.push(candidate);
    }

    const changedByParent = new Map<
      string,
      {
        organizationId: string;
        parentState: string;
        runIds: string[];
      }
    >();
    for (const candidate of changed) {
      const row = rows.find((item) => item.runId === candidate.runId);
      if (!row?.organizationId) continue;
      const group = changedByParent.get(candidate.parentJobId) ?? {
        organizationId: row.organizationId,
        parentState: candidate.parentState,
        runIds: [],
      };
      group.runIds.push(candidate.runId);
      changedByParent.set(candidate.parentJobId, group);
    }
    for (const [parentJobId, group] of changedByParent) {
      await tx.insert(auditEvents).values({
        organizationId: group.organizationId,
        actorUserId: null,
        eventType: "ai_generation.orphan_runs_reconciled",
        entityType: "background_job",
        entityId: parentJobId,
        metadata: {
          parentState: group.parentState,
          runIds: group.runIds,
          changedCount: group.runIds.length,
        },
      });
    }
    return {
      selected: rows.length,
      changed: changed.length,
      skipped: rows.length - changed.length,
      changedByParentState: Object.fromEntries(
        TERMINAL_JOB_STATES.map((state) => [
          state,
          changed.filter((candidate) => candidate.parentState === state).length,
        ]),
      ),
      runs: changed,
    };
  });
}

export async function readGenerationLifecycleInvariants() {
  const [terminalChildren, lateDiagnostics] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiProcessingRuns)
      .innerJoin(backgroundJobs, eq(backgroundJobs.id, aiProcessingRuns.jobId))
      .where(
        and(
          eq(aiProcessingRuns.status, "processing"),
          inArray(backgroundJobs.state, [...TERMINAL_JOB_STATES]),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .innerJoin(backgroundJobs, eq(backgroundJobs.id, auditEvents.entityId))
      .where(
        and(
          eq(auditEvents.eventType, "ai_generation.category_diagnostic"),
          eq(auditEvents.entityType, "background_job"),
          gt(auditEvents.createdAt, backgroundJobs.finishedAt),
        ),
      ),
  ]);
  return {
    terminalJobsWithProcessingRuns: terminalChildren[0]?.count ?? 0,
    categoryDiagnosticsAfterParentFinished: lateDiagnostics[0]?.count ?? 0,
  };
}

function toCandidate(row: {
  runId: string;
  parentJobId: string;
  parentState: string;
  runCreatedAt: Date;
  parentFinishedAt: Date | null;
}): OrphanAiRunCandidate {
  if (!isTerminalJobState(row.parentState)) {
    throw new Error("Reconciliation selected a non-terminal parent");
  }
  return {
    ...row,
    parentState: row.parentState,
    proposedSafeCode:
      row.parentState === "cancelled"
        ? "PARENT_JOB_CANCELLED"
        : "PARENT_JOB_TERMINATED",
  };
}

function isTerminalJobState(
  value: string,
): value is (typeof TERMINAL_JOB_STATES)[number] {
  return (TERMINAL_JOB_STATES as readonly string[]).includes(value);
}
