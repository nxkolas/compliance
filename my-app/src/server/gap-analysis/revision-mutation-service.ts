import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { gapFindings, generatedArtifactRevisions, generatedArtifacts } from "@/src/db/schema";
import type { GapRevisionMutationPayload } from "@/src/contracts/gap-analysis/generation";
import { ApiError } from "../api/errors";
import { assertCanManageOrganization } from "../organizations/service";
import { enqueueJob, toJobDto } from "../jobs";
import { assertGapFindingsMutable } from "./lifecycle-guards";
import { regenerateAndCorrectGapFinding } from "./review-service";

export async function enqueueGapRevisionMutation(input: {
  userId: string;
  organizationId: string;
  payload: GapRevisionMutationPayload;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  await assertGapFindingsMutable(input.organizationId);
  const row = await db
    .select({
      revisionId: generatedArtifactRevisions.id,
      currentRevisionId: generatedArtifacts.currentRevisionId,
      findingId: gapFindings.id,
    })
    .from(generatedArtifactRevisions)
    .innerJoin(
      generatedArtifacts,
      and(
        eq(generatedArtifacts.id, generatedArtifactRevisions.artifactId),
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
      ),
    )
    .leftJoin(
      gapFindings,
      and(
        eq(gapFindings.artifactRevisionId, generatedArtifactRevisions.id),
        eq(gapFindings.id, input.payload.findingId),
      ),
    )
    .where(eq(generatedArtifactRevisions.id, input.payload.sourceRevisionId))
    .limit(1);
  const source = row[0];
  if (!source) {
    throw new ApiError(404, "Gap result not found", undefined, "GAP_REVISION_NOT_FOUND");
  }
  if (source.currentRevisionId !== source.revisionId) {
    throw new ApiError(409, "A newer gap result is already current", undefined, "GAP_REVISION_NOT_CURRENT");
  }
  if (!source.findingId) {
    throw new ApiError(404, "Gap finding not found", undefined, "GAP_FINDING_NOT_FOUND");
  }
  try {
    const job = await enqueueJob({
      kind: "gap-revision-mutation-v1",
      payload: input.payload,
      organizationId: input.organizationId,
      requestedByUserId: input.userId,
      maxAttempts: 3,
      cancellable: true,
      cancellationCapability: "gap:approve",
    });
    return { job: toJobDto(job) };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new ApiError(409, "Another revision update is already running", undefined, "GAP_REVISION_MUTATION_ACTIVE");
    }
    throw error;
  }
}

export async function executeGapRevisionMutation(input: {
  jobId: string;
  workerId: string;
  userId: string;
  organizationId: string;
  payload: GapRevisionMutationPayload;
  abortSignal?: AbortSignal;
}) {
  const revision = await regenerateAndCorrectGapFinding({
    userId: input.userId,
    organizationId: input.organizationId,
    sourceRevisionId: input.payload.sourceRevisionId,
    findingId: input.payload.findingId,
    reason: input.payload.reason,
    retryNonce: input.payload.retryNonce,
    ...(input.payload.mode === "correction"
      ? {
          correctedStatus: input.payload.correctedStatus,
          correctedEvidenceSufficiency: input.payload.correctedEvidenceSufficiency,
          requiresReview: input.payload.requiresReview,
          resolutionReason: input.payload.resolutionReason,
        }
      : {}),
    jobId: input.jobId,
    workerId: input.workerId,
    abortSignal: input.abortSignal,
  });
  return { type: "generated_artifact_revision", id: revision.id };
}
