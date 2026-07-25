import { db } from "@/src/db";
import {
  actionPlanItems,
  actionPlans,
  artifactRevisionAssessmentSources,
  assessmentRevisions,
  assessments,
  auditEvents,
  gapFindingEvidence,
  gapFindings,
  generatedArtifactRevisions,
  generatedArtifacts,
  idempotencyRecordResults,
  idempotencyRecords,
} from "@/src/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { buildActionPlanItems } from "@/src/server/action-plans";
import { ApiError } from "../api/errors";
import { assertCanManageOrganization } from "../organizations/service";
import { assertGapRevisionApprovable } from "./review-service";
import { loadGapAnalysisRelease } from "./release-loader";
import { getGapRevisionStaleness } from "./staleness";
import { readGapRevisionMetadata } from "./gap-revision-metadata";

export async function finalizeGapAnalysisAndGenerateActionPlan(input: {
  userId: string;
  organizationId: string;
  gapRevisionId: string;
  command: {
    actorKey: string;
    scope: string;
    operation: string;
    key: string;
    requestFingerprint: string;
  };
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const staleness = await getGapRevisionStaleness({
    userId: input.userId,
    organizationId: input.organizationId,
    revisionId: input.gapRevisionId,
  });
  if (staleness.stale || staleness.outdatedRelease || staleness.archived) {
    throw new ApiError(
      409,
      "The Gap Analysis inputs are no longer current",
      { staleness },
      "GAP_SOURCES_STALE",
    );
  }

  try {
    return await db.transaction(async (tx) => {
      const [artifact] = await tx
        .select({
          id: generatedArtifacts.id,
          currentRevisionId: generatedArtifacts.currentRevisionId,
        })
        .from(generatedArtifacts)
        .where(
          and(
            eq(generatedArtifacts.organizationId, input.organizationId),
            eq(generatedArtifacts.artifactType, "gap_analysis_result"),
          ),
        )
        .limit(1)
        .for("update");
      if (!artifact || artifact.currentRevisionId !== input.gapRevisionId) {
        throw new ApiError(
          409,
          "Only the current Gap Analysis can be finalized",
          undefined,
          "GAP_REVISION_NOT_CURRENT",
        );
      }
      const revision =
        await tx.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
          where: and(
            eq(generatedArtifactRevisions.id, input.gapRevisionId),
            eq(generatedArtifactRevisions.artifactId, artifact.id),
          ),
        });
      if (!revision?.gapAnalysisReleaseId) {
        throw new ApiError(
          404,
          "Gap result not found",
          undefined,
          "GAP_REVISION_NOT_FOUND",
        );
      }
      const snapshotLocale = readGapRevisionMetadata(revision.result).outputLocale;
      if (
        (revision.outputLocale !== "de" &&
          revision.outputLocale !== "en") ||
        snapshotLocale !== revision.outputLocale
      ) {
        throw new ApiError(
          409,
          "Gap result language metadata is invalid",
          undefined,
          "GAP_OUTPUT_LOCALE_INVALID",
        );
      }
      const outputLocale = revision.outputLocale;
      const existingPlan = await tx.query.actionPlans.findFirst({ columns: { id: true, organizationId: true, sourceGapArtifactRevisionId: true, outputLocale: true, status: true, revisionNumber: true, activatedBy: true, activatedAt: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true, version: true },
        where: eq(actionPlans.organizationId, input.organizationId),
        orderBy: [desc(actionPlans.createdAt)],
      });
      if (existingPlan) {
        const existingSourceRevision =
          await tx.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
            where: eq(
              generatedArtifactRevisions.id,
              existingPlan.sourceGapArtifactRevisionId,
            ),
          });
        const existingSnapshotLocale = existingSourceRevision
          ? readGapRevisionMetadata(existingSourceRevision.result).outputLocale
          : undefined;
        if (
          !existingSourceRevision ||
          existingPlan.outputLocale !==
            existingSourceRevision.outputLocale ||
          existingSnapshotLocale !== existingPlan.outputLocale
        ) {
          throw new ApiError(
            409,
            "Action plan language conflicts with its Gap result",
            { actionPlanId: existingPlan.id },
            "GAP_OUTPUT_LOCALE_CONFLICT",
          );
        }
        throw new ApiError(
          409,
          "An action plan already exists",
          { actionPlanId: existingPlan.id },
          "ACTION_PLAN_ALREADY_EXISTS",
        );
      }

      const assessmentSources = await tx.query.artifactRevisionAssessmentSources.findMany({
        where: eq(
          artifactRevisionAssessmentSources.artifactRevisionId,
          revision.id,
        ),
        columns: { assessmentRevisionId: true },
      });
      if (assessmentSources.length !== 1) {
        throw new ApiError(
          409,
          "Gap revision assessment source is missing",
          undefined,
          "GAP_INPUT_SNAPSHOT_INVALID",
        );
      }
      const assessmentRevision =
        await tx.query.assessmentRevisions.findFirst({ columns: { id: true, assessmentId: true, questionnaireVersionId: true, revisionNumber: true, parentRevisionId: true, status: true, createdBy: true, createdAt: true, submittedAt: true },
          where: eq(
            assessmentRevisions.id,
            assessmentSources[0]!.assessmentRevisionId,
          ),
        });
      const assessment = assessmentRevision
        ? await tx.query.assessments.findFirst({ columns: { id: true, organizationId: true, moduleId: true, questionnaireId: true, checkReleaseId: true, gapAnalysisReleaseId: true, applicabilityArtifactRevisionId: true, currentRevisionId: true, status: true, createdBy: true, createdAt: true },
            where: and(
              eq(assessments.id, assessmentRevision.assessmentId),
              eq(assessments.organizationId, input.organizationId),
            ),
          })
        : null;
      if (!assessment?.applicabilityArtifactRevisionId) {
        throw new ApiError(
          409,
          "Pinned applicability source is missing",
          undefined,
          "GAP_INPUT_SNAPSHOT_INVALID",
        );
      }
      const applicability =
        await tx.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
          where: eq(
            generatedArtifactRevisions.id,
            assessment.applicabilityArtifactRevisionId,
          ),
        });
      const outcome = (
        applicability?.result as { outcome?: unknown } | undefined
      )?.outcome;
      if (applicability?.status !== "approved" || typeof outcome !== "string") {
        throw new ApiError(
          409,
          "Pinned applicability outcome is unavailable",
          undefined,
          "GAP_INPUT_SNAPSHOT_INVALID",
        );
      }
      const release = await loadGapAnalysisRelease(
        revision.gapAnalysisReleaseId,
        outputLocale,
      );
      if (!release) {
        throw new ApiError(
          409,
          "Pinned Gap release is unavailable",
          undefined,
          "GAP_INPUT_SNAPSHOT_INVALID",
        );
      }
      const expectedRequirementVersionIds = release.requirements
        .filter((requirement) =>
          requirement.applicabilityOutcomeCodes.includes(outcome),
        )
        .map((requirement) => requirement.id);
      const findings = await tx.query.gapFindings.findMany({ columns: { id: true, artifactRevisionId: true, requirementVersionId: true, status: true, evidenceSufficiency: true, severity: true, rationale: true, recommendation: true, assumptions: true, requiresReview: true, createdAt: true },
        where: eq(gapFindings.artifactRevisionId, revision.id),
      });
      const evidence = findings.length
        ? await tx.query.gapFindingEvidence.findMany({ columns: { id: true, findingId: true, citationId: true, sourceType: true, assessmentAnswerId: true, documentChunkId: true, legalSourceChunkId: true, excerpt: true, pageNumber: true, sectionLabel: true, createdAt: true },
            where: inArray(
              gapFindingEvidence.findingId,
              findings.map((finding) => finding.id),
            ),
          })
        : [];
      assertGapRevisionApprovable({
        expectedRequirementVersionIds,
        findings,
        evidence,
      });

      const requirementById = new Map(
        release.requirements.map((requirement) => [
          requirement.id,
          requirement,
        ]),
      );
      const baseline = buildActionPlanItems(
        findings.map((finding) => {
          const requirement = requirementById.get(
            finding.requirementVersionId,
          );
          if (!requirement) {
            throw new ApiError(409, "Pinned requirement is missing");
          }
          return {
            id: finding.id,
            status: finding.status,
            severity: finding.severity,
            requirementTitle: requirement.title,
            recommendation: finding.recommendation,
          };
        }),
      );
      const approvedAt = new Date();
      const [approvedRevision] = await tx
        .update(generatedArtifactRevisions)
        .set({
          status: "approved",
          approvedBy: input.userId,
          approvedAt,
        })
        .where(
          and(
            eq(generatedArtifactRevisions.id, revision.id),
            inArray(generatedArtifactRevisions.status, [
              "generated",
              "reviewed",
            ]),
          ),
        )
        .returning();
      if (!approvedRevision) {
        throw new ApiError(
          409,
          "The Gap Analysis is no longer editable",
          undefined,
          "GAP_REVISION_NOT_CURRENT",
        );
      }
      const [acceptedArtifact] = await tx
        .update(generatedArtifacts)
        .set({ acceptedRevisionId: revision.id })
        .where(
          and(
            eq(generatedArtifacts.id, artifact.id),
            eq(generatedArtifacts.currentRevisionId, revision.id),
          ),
        )
        .returning({ id: generatedArtifacts.id });
      if (!acceptedArtifact) {
        throw new ApiError(
          409,
          "Only the current Gap Analysis can be finalized",
          undefined,
          "GAP_REVISION_NOT_CURRENT",
        );
      }
      const [plan] = await tx
        .insert(actionPlans)
        .values({
          organizationId: input.organizationId,
          sourceGapArtifactRevisionId: revision.id,
          outputLocale,
          revisionNumber: 1,
          activatedBy: input.userId,
          activatedAt: approvedAt,
          createdBy: input.userId,
        })
        .returning();
      if (!plan) {
        throw new ApiError(
          500,
          "Could not create action plan",
          undefined,
          "GAP_FINALIZATION_FAILED",
        );
      }
      if (baseline.length) {
        await tx.insert(actionPlanItems).values(
          baseline.map((item) => ({
            ...item,
            actionPlanId: plan.id,
          })),
        );
      }
      await tx.insert(auditEvents).values([
        {
          organizationId: input.organizationId,
          actorUserId: input.userId,
          eventType: "gap_revision.approved",
          entityType: "generated_artifact_revision",
          entityId: revision.id,
          metadata: { actionPlanId: plan.id },
        },
        {
          organizationId: input.organizationId,
          actorUserId: input.userId,
          eventType: "action_plan.generated",
          entityType: "action_plan",
          entityId: plan.id,
          metadata: {
            sourceGapArtifactRevisionId: revision.id,
            itemCount: baseline.length,
          },
        },
      ]);
      const [completedCommand] = await tx
        .update(idempotencyRecords)
        .set({
          state: "succeeded",
          responseStatus: 201,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(idempotencyRecords.actorKey, input.command.actorKey),
            eq(idempotencyRecords.scope, input.command.scope),
            eq(idempotencyRecords.operation, input.command.operation),
            eq(idempotencyRecords.key, input.command.key),
            eq(
              idempotencyRecords.requestFingerprint,
              input.command.requestFingerprint,
            ),
            inArray(idempotencyRecords.state, [
              "in_progress",
              "failed",
            ]),
          ),
        )
        .returning({ id: idempotencyRecords.id });
      if (!completedCommand) {
        throw new ApiError(
          409,
          "The finalization command is no longer active",
          undefined,
          "IDEMPOTENCY_IN_PROGRESS",
        );
      }
      await tx.insert(idempotencyRecordResults).values({
        recordId: completedCommand.id,
        actionPlanId: plan.id,
      });
      return {
        plan,
        revision: approvedRevision,
        itemCount: baseline.length,
      };
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Could not finalize Gap Analysis", {
      organizationId: input.organizationId,
      gapRevisionId: input.gapRevisionId,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    throw new ApiError(
      500,
      "The Gap Analysis could not be finalized",
      undefined,
      "GAP_FINALIZATION_FAILED",
    );
  }
}
