import { db } from "@/src/db";
import {
  actionPlans,
  gapReassessmentDrafts,
  generatedArtifacts,
} from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";

export async function assertGapInputsMutable(input: {
  organizationId: string;
  moduleId: string;
}) {
  const activeGeneration = await db.query.gapReassessmentDrafts.findFirst({ columns: { id: true, organizationId: true, assessmentId: true, gapAnalysisReleaseId: true, baseAcceptedGapRevisionId: true, assessmentRevisionId: true, status: true, outputLocale: true, lockVersion: true, aiProcessingRunId: true, generationJobId: true, outputGapRevisionId: true, createdBy: true, createdAt: true, updatedAt: true, lockedAt: true, completedAt: true },
    where: and(
      eq(gapReassessmentDrafts.organizationId, input.organizationId),
      eq(gapReassessmentDrafts.status, "locked"),
    ),
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
    where: and(
      eq(generatedArtifacts.organizationId, input.organizationId),
      eq(generatedArtifacts.moduleId, input.moduleId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ),
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
  const plan = await db.query.actionPlans.findFirst({ columns: { id: true, organizationId: true, sourceGapArtifactRevisionId: true, outputLocale: true, status: true, revisionNumber: true, activatedBy: true, activatedAt: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true, version: true },
    where: and(
      eq(actionPlans.organizationId, organizationId),
      eq(actionPlans.status, "active"),
    ),
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
