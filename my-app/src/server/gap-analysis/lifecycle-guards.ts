import { db } from "@/src/db";import { and, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { ACTION_PLAN_GENERATION_JOB_KINDS } from "../jobs";

export async function assertGapInputsMutable(input: {
  organizationId: string;
  moduleId: string;
}) {
  const activeGeneration = await db.query.gapReassessmentDrafts.findFirst({ columns: { id: true, organizationId: true, assessmentId: true, gapAnalysisReleaseId: true, baseAcceptedGapRevisionId: true, assessmentRevisionId: true, status: true, outputLocale: true, lockVersion: true, aiProcessingRunId: true, generationJobId: true, outputGapRevisionId: true, createdBy: true, createdAt: true, updatedAt: true, lockedAt: true, completedAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.organizationId, input.organizationId),
      eq(table.status, "locked"),
    )) ?? operators.sql`true` },
  });
  if (activeGeneration) {
    throw new ApiError(
      409,
      "Gap Analysis generation is in progress",
      undefined,
      "GAP_INPUTS_LOCKED",
    );
  }
  const artifact = await db.query.generatedArtifacts.findFirst({ columns: { id: true, organizationId: true, moduleId: true, artifactType: true, currentRevisionId: true, acceptedRevisionId: true, createdAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.organizationId, input.organizationId),
      eq(table.moduleId, input.moduleId),
      eq(table.artifactType, "gap_analysis_result"),
    )) ?? operators.sql`true` },
  });
  if (artifact?.currentRevisionId) {
    throw new ApiError(
      409,
      "A Gap Analysis has already been generated",
      undefined,
      "GAP_ALREADY_GENERATED",
    );
  }
}

export async function assertGapFindingsMutable(organizationId: string) {
  const reservation = await db.query.backgroundJobs.findFirst({
    columns: { id: true },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, organizationId),
          operators.inArray(table.kind, [
            ...ACTION_PLAN_GENERATION_JOB_KINDS,
          ]),
          operators.inArray(table.state, [
            "queued",
            "running",
            "cancellation_requested",
          ]),
        ) ?? operators.sql`true`,
    },
  });
  if (reservation) {
    throw new ApiError(
      409,
      "The Gap Analysis is reserved for Action Plan generation",
      undefined,
      "GAP_RESERVED_BY_ACTION_PLAN_GENERATION",
    );
  }
  const plan = await db.query.actionPlans.findFirst({ columns: { id: true, organizationId: true, sourceGapArtifactRevisionId: true, outputLocale: true, status: true, revisionNumber: true, activatedBy: true, activatedAt: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true, version: true },
    where: { RAW: (table, operators) => (and(
      eq(table.organizationId, organizationId),
      eq(table.status, "active"),
    )) ?? operators.sql`true` },
  });
  if (plan) {
    throw new ApiError(
      409,
      "The Gap Analysis is locked by its action plan",
      undefined,
      "GAP_LOCKED_BY_ACTION_PLAN",
    );
  }
}
