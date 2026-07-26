import { db } from "@/src/db";
import {
  aiProcessingRunAssessmentInputs,
  aiProcessingRunDocumentInputs,
  aiProcessingRuns,
  artifactRevisionArtifactSources,
  artifactRevisionAssessmentSources,
  artifactRevisionDocumentSources,
  assessmentAnswerOptions,
  auditEvents,
  gapFindingEvidence,
  gapFindingReviewResolutions,
  gapFindings,
  gapRequirements,
  gapRequirementVersions,
  generatedArtifactRevisions,
  generatedArtifacts,
  questionOptions,
} from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { contentHash } from "@/src/server/compliance";
import {
  buildCorrectedGapRevisionMetadata,
  readGapRevisionMetadata,
} from "./gap-revision-metadata";
import { ApiError } from "../api/errors";
import { assertCanManageOrganization } from "../organizations/service";
import { deriveFindingSeverity } from "./generation-schema";
import { loadGapAnalysisRelease } from "./release-loader";
import { assertGapFindingsMutable } from "./lifecycle-guards";
import {
  deriveCorrectedGapGuidancePolicy,
} from "./guidance-policy";
import { generateGapGuidance } from "./guidance-generation";

export type FindingApprovalSnapshot = {
  id: string;
  requirementVersionId: string;
  status:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence";
  requiresReview: boolean;
};

export type GapFindingCorrection = {
  findingId: string;
  status?: FindingApprovalSnapshot["status"];
  evidenceSufficiency?: "sufficient" | "partial" | "none";
  requiresReview?: boolean;
  reason: string;
  resolutionReason?: string;
};

export function assertGapCorrectionReasons(
  corrections: GapFindingCorrection[],
) {
  for (const correction of corrections) {
    if (!correction.reason.trim()) {
      throw new ApiError(
        400,
        "Every assessment change requires a reason",
        { findingId: correction.findingId, field: "reason" },
        "GAP_CORRECTION_REASON_REQUIRED",
      );
    }
  }
}

export function resolveGapFindingCorrection(input: {
  source: {
    id: string;
    status: FindingApprovalSnapshot["status"];
    evidenceSufficiency: "sufficient" | "partial" | "none";
    requiresReview: boolean;
  };
  correction?: GapFindingCorrection;
  criticality: "low" | "medium" | "high" | "critical";
}) {
  const status = input.correction?.status ?? input.source.status;
  const requiresReview =
    input.correction?.requiresReview ?? input.source.requiresReview;
  if (
    input.source.requiresReview &&
    !requiresReview &&
    !input.correction?.resolutionReason?.trim()
  ) {
    throw new ApiError(
      400,
      "Clearing a review blocker requires a resolution reason",
      { findingId: input.source.id, field: "resolutionReason" },
      "GAP_REVIEW_RESOLUTION_REQUIRED",
    );
  }
  return {
    status,
    requiresReview,
    evidenceSufficiency:
      input.correction?.evidenceSufficiency ?? input.source.evidenceSufficiency,
    severity: deriveFindingSeverity(input.criticality, status),
  };
}

export function assertGapRevisionApprovable(input: {
  expectedRequirementVersionIds: string[];
  findings: FindingApprovalSnapshot[];
  evidence: Array<{
    findingId: string;
    citationId: string;
    sourceType: "assessment_answer" | "document_chunk" | "legal_source_chunk";
  }>;
}) {
  const expected = new Set(input.expectedRequirementVersionIds);
  const actual = new Set(
    input.findings.map((finding) => finding.requirementVersionId),
  );
  if (
    actual.size !== input.findings.length ||
    actual.size !== expected.size ||
    [...expected].some((id) => !actual.has(id))
  ) {
    throw new ApiError(
      409,
      "Gap finding coverage is incomplete",
      undefined,
      "GAP_COVERAGE_INCOMPLETE",
    );
  }
  for (const finding of input.findings) {
    if (finding.requiresReview) {
      throw new ApiError(
        409,
        "Resolve all review blockers before confirmation",
        { findingId: finding.id },
        "GAP_REVIEW_UNRESOLVED",
      );
    }
    const citations = input.evidence.filter(
      (evidence) => evidence.findingId === finding.id,
    );
    if (citations.some((citation) => !citation.citationId.trim())) {
      throw new ApiError(
        409,
        "A finding contains an invalid citation",
        undefined,
        "GAP_CITATION_INVALID",
      );
    }
  }
}

export function copyGapFindingEvidenceValues(
  item: Pick<
    typeof gapFindingEvidence.$inferSelect,
    | "citationId"
    | "sourceType"
    | "assessmentAnswerId"
    | "documentChunkId"
    | "legalSourceChunkId"
    | "excerpt"
    | "pageNumber"
    | "sectionLabel"
  >,
  findingId: string,
): typeof gapFindingEvidence.$inferInsert {
  return {
    findingId,
    citationId: item.citationId,
    sourceType: item.sourceType,
    assessmentAnswerId: item.assessmentAnswerId,
    documentChunkId: item.documentChunkId,
    legalSourceChunkId: item.legalSourceChunkId,
    excerpt: item.excerpt,
    pageNumber: item.pageNumber,
    sectionLabel: item.sectionLabel,
  };
}

export async function correctGapRevision(input: {
  userId: string;
  organizationId: string;
  sourceRevisionId: string;
  corrections: GapFindingCorrection[];
}) {
  if (input.corrections.length !== 1) {
    throw new ApiError(
      400,
      "Correct exactly one finding at a time",
      undefined,
      "GAP_CORRECTION_CARDINALITY_INVALID",
    );
  }
  const correction = input.corrections[0]!;
  return regenerateAndCorrectGapFinding({
    userId: input.userId,
    organizationId: input.organizationId,
    sourceRevisionId: input.sourceRevisionId,
    findingId: correction.findingId,
    correctedStatus: correction.status,
    correctedEvidenceSufficiency: correction.evidenceSufficiency,
    requiresReview: correction.requiresReview,
    reason: correction.reason,
    resolutionReason: correction.resolutionReason,
  });
}

export async function regenerateGapFindingGuidance(input: {
  userId: string;
  organizationId: string;
  sourceRevisionId: string;
  findingId: string;
  reason: string;
  retryNonce?: string;
}) {
  return regenerateAndCorrectGapFinding({
    ...input,
    retryNonce: input.retryNonce,
  });
}

export async function regenerateAndCorrectGapFinding(input: {
  userId: string;
  organizationId: string;
  sourceRevisionId: string;
  findingId: string;
  correctedStatus?: FindingApprovalSnapshot["status"];
  correctedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  requiresReview?: boolean;
  reason: string;
  resolutionReason?: string;
  retryNonce?: string;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  await assertGapFindingsMutable(input.organizationId);
  if (!input.reason.trim()) {
    throw new ApiError(
      400,
      "Every guidance change requires a reason",
      undefined,
      "GAP_CORRECTION_REASON_REQUIRED",
    );
  }
  const sourceRevision =
    await db.query.generatedArtifactRevisions.findFirst({
      columns: {
        id: true,
        artifactId: true,
        revisionNumber: true,
        status: true,
        result: true,
        outputLocale: true,
        modelName: true,
        promptVersion: true,
        gapAnalysisReleaseId: true,
        evaluatorKind: true,
        evaluatedAt: true,
        inputHash: true,
      },
      where: {
        RAW: (table, operators) =>
          eq(table.id, input.sourceRevisionId) ??
          operators.sql`true`,
      },
    });
  if (
    !sourceRevision?.gapAnalysisReleaseId ||
    (sourceRevision.outputLocale !== "de" &&
      sourceRevision.outputLocale !== "en")
  ) {
    throw new ApiError(
      404,
      "Gap result not found",
      undefined,
      "GAP_REVISION_NOT_FOUND",
    );
  }
  if (
    readGapRevisionMetadata(sourceRevision.result).outputLocale !==
    sourceRevision.outputLocale
  ) {
    throw new ApiError(
      409,
      "Gap result language metadata is invalid",
      undefined,
      "GAP_OUTPUT_LOCALE_INVALID",
    );
  }
  const artifact = await db.query.generatedArtifacts.findFirst({
    columns: {
      id: true,
      organizationId: true,
      currentRevisionId: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, sourceRevision.artifactId),
          eq(table.organizationId, input.organizationId),
          eq(table.artifactType, "gap_analysis_result"),
        ) ?? operators.sql`true`,
    },
  });
  if (!artifact || artifact.currentRevisionId !== sourceRevision.id) {
    throw new ApiError(
      409,
      "A newer gap result is already current",
      undefined,
      "GAP_REVISION_NOT_CURRENT",
    );
  }
  const sourceFindings = await db.query.gapFindings.findMany({
    columns: {
      id: true,
      artifactRevisionId: true,
      requirementVersionId: true,
      status: true,
      evidenceSufficiency: true,
      guidanceMode: true,
      guidanceBasis: true,
      guidanceBasisHash: true,
      severity: true,
      rationale: true,
      recommendation: true,
      objective: true,
      deliverables: true,
      acceptanceCriteria: true,
      suggestedEvidence: true,
      guidanceRunId: true,
      assumptions: true,
      requiresReview: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.artifactRevisionId, sourceRevision.id) ??
        operators.sql`true`,
    },
  });
  const sourceFinding = sourceFindings.find(
    (finding) => finding.id === input.findingId,
  );
  if (!sourceFinding) {
    throw new ApiError(
      404,
      "Gap finding not found",
      undefined,
      "GAP_FINDING_NOT_FOUND",
    );
  }
  const sourceResolution =
    await db.query.gapFindingReviewResolutions.findFirst({
      columns: { reason: true },
      where: {
        RAW: (table, operators) =>
          eq(table.findingId, sourceFinding.id) ??
          operators.sql`true`,
      },
      orderBy: { createdAt: "desc" },
    });
  const effectiveResolutionReason =
    input.resolutionReason?.trim() ??
    sourceResolution?.reason.trim();
  const release = await loadGapAnalysisRelease(
    sourceRevision.gapAnalysisReleaseId,
    sourceRevision.outputLocale,
  );
  if (
    !release ||
    release.prompt.responseSchemaVersion !== "6"
  ) {
    throw new ApiError(
      409,
      "This Gap release does not support guidance regeneration",
      undefined,
      "GAP_GUIDANCE_REGENERATION_UNSUPPORTED",
    );
  }
  const requirement = release.requirements.find(
    (candidate) => candidate.id === sourceFinding.requirementVersionId,
  );
  if (!requirement) {
    throw new ApiError(
      409,
      "Pinned requirement is missing",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  const resolved = resolveGapFindingCorrection({
    source: sourceFinding,
    correction: {
      findingId: input.findingId,
      status: input.correctedStatus,
      evidenceSufficiency: input.correctedEvidenceSufficiency,
      requiresReview: input.requiresReview,
      reason: input.reason,
      resolutionReason: input.resolutionReason,
    },
    criticality: requirement.criticality,
  });
  const [assessmentSources, artifactSources, documentSources] =
    await Promise.all([
      db.query.artifactRevisionAssessmentSources.findMany({
        columns: { assessmentRevisionId: true },
        where: {
          RAW: (table, operators) =>
            eq(table.artifactRevisionId, sourceRevision.id) ??
            operators.sql`true`,
        },
      }),
      db.query.artifactRevisionArtifactSources.findMany({
        columns: { sourceArtifactRevisionId: true },
        where: {
          RAW: (table, operators) =>
            eq(table.artifactRevisionId, sourceRevision.id) ??
            operators.sql`true`,
        },
      }),
      db.query.artifactRevisionDocumentSources.findMany({
        columns: { documentVersionId: true },
        where: {
          RAW: (table, operators) =>
            eq(table.artifactRevisionId, sourceRevision.id) ??
            operators.sql`true`,
        },
      }),
    ]);
  if (assessmentSources.length !== 1) {
    throw new ApiError(
      409,
      "Gap revision assessment source is invalid",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  const assessmentRevisionId =
    assessmentSources[0]!.assessmentRevisionId;
  const answers = await db.query.assessmentAnswers.findMany({
    columns: {
      id: true,
      questionId: true,
      questionStableKey: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.assessmentRevisionId, assessmentRevisionId) ??
        operators.sql`true`,
    },
  });
  const relevantAnswers = answers.filter((answer) =>
    requirement.questionStableKeys.includes(answer.questionStableKey),
  );
  const selectedOptions = relevantAnswers.length
    ? await db
        .select({
          answerId: assessmentAnswerOptions.assessmentAnswerId,
          stableValue: questionOptions.stableValue,
        })
        .from(assessmentAnswerOptions)
        .innerJoin(
          questionOptions,
          eq(
            assessmentAnswerOptions.questionOptionId,
            questionOptions.id,
          ),
        )
        .where(
          inArray(
            assessmentAnswerOptions.assessmentAnswerId,
            relevantAnswers.map((answer) => answer.id),
          ),
        )
    : [];
  const guidanceQuestions = requirement.questionStableKeys.map(
    (stableKey) => {
      const question = release.questions.find(
        (candidate) => candidate.stableKey === stableKey,
      );
      const answer = relevantAnswers.find(
        (candidate) => candidate.questionStableKey === stableKey,
      );
      const options = answer
        ? selectedOptions.filter(
            (option) => option.answerId === answer.id,
          )
        : [];
      const stableValue = options[0]?.stableValue;
      if (
        !question ||
        !answer ||
        options.length !== 1 ||
        !isGuidanceAnswerValue(stableValue)
      ) {
        throw new ApiError(
          409,
          "Pinned answer coverage is incomplete",
          undefined,
          "GAP_INPUT_SNAPSHOT_INVALID",
        );
      }
      return {
        stableKey,
        text: question.questionText,
        stableValue,
        legalProvisions: question.legalProvisions,
      };
    },
  );
  let policy;
  try {
    policy = deriveCorrectedGapGuidancePolicy({
      determinedStatus: resolved.status,
      questions: guidanceQuestions,
      correctionReason: input.reason,
    });
  } catch {
    throw new ApiError(
      409,
      "The correction reason must identify the affected requirement question",
      undefined,
      "GAP_CORRECTED_TRIGGER_UNRESOLVED",
    );
  }
  const idempotencyKey = contentHash({
    operation: "gap_guidance_regeneration",
    sourceRevisionId: sourceRevision.id,
    findingId: sourceFinding.id,
    status: resolved.status,
    evidenceSufficiency: resolved.evidenceSufficiency,
    requiresReview: resolved.requiresReview,
    reason: input.reason.trim(),
    retryNonce: input.retryNonce ?? "correction",
  });
  const generated = await generateGapGuidance({
    actor: { userId: input.userId },
    organizationId: input.organizationId,
    assessmentRevisionId,
    release,
    requirement,
    policy,
    selectedDocumentVersionIds: documentSources.map(
      (source) => source.documentVersionId,
    ),
    outputLocale: sourceRevision.outputLocale,
    idempotencyKey,
    runOperationKind: "gap_guidance_regeneration",
    forcedEvidenceSufficiency: resolved.evidenceSufficiency,
    forcedRequiresReview: resolved.requiresReview,
    reviewCorrection: {
      reason: input.reason.trim(),
      resolutionReason: effectiveResolutionReason,
    },
  });
  if (
    generated.guidance.evidenceSufficiency !==
      resolved.evidenceSufficiency ||
    generated.guidance.requiresReview !== resolved.requiresReview
  ) {
    throw new ApiError(
      422,
      "Regenerated guidance conflicts with corrected facts",
      undefined,
      "GAP_GUIDANCE_REGENERATION_INVALID",
    );
  }
  try {
    const documentRows = documentSources.length
    ? await db.query.documentVersions.findMany({
        columns: { id: true, contentHash: true },
        where: {
          RAW: (table, operators) =>
            inArray(
              table.id,
              documentSources.map(
                (source) => source.documentVersionId,
              ),
            ) ?? operators.sql`true`,
        },
      })
    : [];
  await Promise.all([
    db
      .insert(aiProcessingRunAssessmentInputs)
      .values({
        runId: generated.runId,
        assessmentRevisionId,
        sourceHash: contentHash(answers),
      })
      .onConflictDoNothing(),
    documentRows.length
      ? db
          .insert(aiProcessingRunDocumentInputs)
          .values(
            documentRows.map((document) => ({
              runId: generated.runId,
              documentVersionId: document.id,
              sourceHash: document.contentHash,
            })),
          )
          .onConflictDoNothing()
      : Promise.resolve(),
  ]);
  const sourceEvidence = await db.query.gapFindingEvidence.findMany({
    columns: {
      findingId: true,
      citationId: true,
      sourceType: true,
      assessmentAnswerId: true,
      documentChunkId: true,
      legalSourceChunkId: true,
      excerpt: true,
      pageNumber: true,
      sectionLabel: true,
    },
    where: {
      RAW: (table, operators) =>
        inArray(
          table.findingId,
          sourceFindings.map((finding) => finding.id),
        ) ?? operators.sql`true`,
    },
  });
  const run = await db.query.aiProcessingRuns.findFirst({
    columns: { id: true, model: true },
    where: {
      RAW: (table, operators) =>
        eq(table.id, generated.runId) ?? operators.sql`true`,
    },
  });
  if (!run) throw new Error("Guidance run was not persisted");
    return await db.transaction(async (tx) => {
      const [lockedArtifact] = await tx
        .select({
          currentRevisionId: generatedArtifacts.currentRevisionId,
        })
        .from(generatedArtifacts)
        .where(eq(generatedArtifacts.id, artifact.id))
        .limit(1)
        .for("update");
      if (lockedArtifact?.currentRevisionId !== sourceRevision.id) {
        throw new ApiError(
          409,
          "A newer gap result is already current",
          undefined,
          "GAP_REVISION_NOT_CURRENT",
        );
      }
      const activePlan = await tx.query.actionPlans.findFirst({
        columns: { id: true },
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.organizationId, input.organizationId),
              eq(table.status, "active"),
            ) ?? operators.sql`true`,
        },
      });
      if (activePlan) {
        throw new ApiError(
          409,
          "The Gap Analysis is locked by its action plan",
          undefined,
          "GAP_LOCKED_BY_ACTION_PLAN",
        );
      }
      const latest =
        await tx.query.generatedArtifactRevisions.findFirst({
          columns: { revisionNumber: true },
          where: {
            RAW: (table, operators) =>
              eq(table.artifactId, artifact.id) ??
              operators.sql`true`,
          },
          orderBy: { revisionNumber: "desc" },
        });
      const guidanceOnly =
        input.correctedStatus === undefined &&
        input.correctedEvidenceSufficiency === undefined &&
        input.requiresReview === undefined;
      const summary = buildCorrectedGapRevisionMetadata({
        source: sourceRevision.result,
        sourceRevisionId: sourceRevision.id,
        expectedRequirementVersionIds: sourceFindings.map(
          (finding) => finding.requirementVersionId,
        ),
        correctedRequirementVersionIds: [requirement.id],
      });
      const [revision] = await tx
        .insert(generatedArtifactRevisions)
        .values({
          artifactId: artifact.id,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          parentRevisionId: sourceRevision.id,
          status: "reviewed",
          result: summary,
          outputLocale: sourceRevision.outputLocale,
          modelName: run.model ?? sourceRevision.modelName,
          promptVersion: release.prompt.version,
          gapAnalysisReleaseId: release.id,
          evaluatorKind: sourceRevision.evaluatorKind,
          evaluatedAt: sourceRevision.evaluatedAt,
          inputHash: contentHash({
            parentInputHash: sourceRevision.inputHash,
            guidanceRunId: generated.runId,
            correctedFacts: {
              status: resolved.status,
              evidenceSufficiency: resolved.evidenceSufficiency,
              requiresReview: resolved.requiresReview,
            },
          }),
          generatedBy: "ai",
          createdBy: input.userId,
        })
        .returning();
      if (!revision) {
        throw new Error("Could not create corrected Gap revision");
      }
      await tx.insert(artifactRevisionAssessmentSources).values(
        assessmentSources.map((source) => ({
          artifactRevisionId: revision.id,
          assessmentRevisionId: source.assessmentRevisionId,
        })),
      );
      if (artifactSources.length) {
        await tx.insert(artifactRevisionArtifactSources).values(
          artifactSources.map((source) => ({
            artifactRevisionId: revision.id,
            sourceArtifactRevisionId:
              source.sourceArtifactRevisionId,
          })),
        );
      }
      if (documentSources.length) {
        await tx.insert(artifactRevisionDocumentSources).values(
          documentSources.map((source) => ({
            artifactRevisionId: revision.id,
            documentVersionId: source.documentVersionId,
          })),
        );
      }
      for (const source of sourceFindings) {
        const isTarget = source.id === sourceFinding.id;
        const [created] = await tx
          .insert(gapFindings)
          .values({
            artifactRevisionId: revision.id,
            requirementVersionId: source.requirementVersionId,
            status: isTarget ? resolved.status : source.status,
            evidenceSufficiency: isTarget
              ? generated.guidance.evidenceSufficiency
              : source.evidenceSufficiency,
            guidanceMode: isTarget
              ? generated.guidance.guidanceMode
              : source.guidanceMode,
            guidanceBasis: isTarget
              ? generated.guidance.guidanceBasis
              : source.guidanceBasis,
            guidanceBasisHash: isTarget
              ? generated.guidance.guidanceBasisHash
              : source.guidanceBasisHash,
            severity: isTarget ? resolved.severity : source.severity,
            rationale: isTarget
              ? generated.guidance.rationale
              : source.rationale,
            recommendation: isTarget
              ? generated.guidance.recommendation
              : source.recommendation,
            objective: isTarget
              ? generated.guidance.objective
              : source.objective,
            deliverables: isTarget
              ? generated.guidance.deliverables
              : source.deliverables,
            acceptanceCriteria: isTarget
              ? generated.guidance.acceptanceCriteria
              : source.acceptanceCriteria,
            suggestedEvidence: isTarget
              ? generated.guidance.suggestedEvidence
              : source.suggestedEvidence,
            guidanceRunId: isTarget
              ? generated.runId
              : source.guidanceRunId,
            assumptions: isTarget
              ? generated.guidance.assumptions
              : source.assumptions,
            requiresReview: isTarget
              ? generated.guidance.requiresReview
              : source.requiresReview,
          })
          .returning();
        if (!created) throw new Error("Could not copy Gap finding");
        if (isTarget) {
          const contextByCitation = new Map(
            generated.context.map((item) => [item.citationId, item]),
          );
          const evidenceValues = generated.guidance.citations.map(
            (citationId) => {
              const item = contextByCitation.get(citationId);
              if (!item) {
                throw new Error(
                  "Regenerated citation context is incomplete",
                );
              }
              return {
                findingId: created.id,
                citationId,
                sourceType:
                  item.channel === "legal"
                    ? ("legal_source_chunk" as const)
                    : item.channel === "organization_document"
                      ? ("document_chunk" as const)
                      : ("assessment_answer" as const),
                assessmentAnswerId:
                  item.channel === "questionnaire_assertion"
                    ? item.sourceId
                    : null,
                documentChunkId:
                  item.channel === "organization_document"
                    ? item.sourceId
                    : null,
                legalSourceChunkId:
                  item.channel === "legal" ? item.sourceId : null,
                excerpt: item.excerpt,
                pageNumber:
                  typeof item.metadata.pageNumber === "number"
                    ? item.metadata.pageNumber
                    : null,
                sectionLabel:
                  typeof item.metadata.sectionPath === "string"
                    ? item.metadata.sectionPath
                    : null,
              };
            },
          );
          if (evidenceValues.length) {
            await tx.insert(gapFindingEvidence).values(evidenceValues);
          }
        } else {
          const evidence = sourceEvidence.filter(
            (item) => item.findingId === source.id,
          );
          if (evidence.length) {
            await tx.insert(gapFindingEvidence).values(
              evidence.map((item) =>
                copyGapFindingEvidenceValues(item, created.id),
              ),
            );
          }
        }
        if (
          isTarget &&
          effectiveResolutionReason &&
          !resolved.requiresReview
        ) {
          await tx.insert(gapFindingReviewResolutions).values({
            artifactRevisionId: revision.id,
            findingId: created.id,
            reason: effectiveResolutionReason,
            resolvedBy: input.userId,
          });
        }
      }
      const [advanced] = await tx
        .update(generatedArtifacts)
        .set({ currentRevisionId: revision.id })
        .where(
          and(
            eq(generatedArtifacts.id, artifact.id),
            eq(
              generatedArtifacts.currentRevisionId,
              sourceRevision.id,
            ),
          ),
        )
        .returning({ id: generatedArtifacts.id });
      if (!advanced) {
        throw new ApiError(
          409,
          "A newer gap result is already current",
          undefined,
          "GAP_REVISION_NOT_CURRENT",
        );
      }
      await tx
        .update(aiProcessingRuns)
        .set({
          status: "succeeded",
          outputArtifactRevisionId: revision.id,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(aiProcessingRuns.id, generated.runId),
            eq(aiProcessingRuns.status, "processing"),
          ),
        );
      await tx.insert(auditEvents).values([
        {
          organizationId: input.organizationId,
          actorUserId: input.userId,
          eventType: guidanceOnly
            ? "gap_guidance.regenerated"
            : "gap_revision.corrected",
          entityType: "generated_artifact_revision",
          entityId: revision.id,
          metadata: {
            parentRevisionId: sourceRevision.id,
            findingId: sourceFinding.id,
            reason: input.reason.trim(),
            guidanceRunId: generated.runId,
          },
        },
        {
          organizationId: input.organizationId,
          actorUserId: input.userId,
          eventType: "ai_run.succeeded",
          entityType: "ai_processing_run",
          entityId: generated.runId,
          metadata: { artifactRevisionId: revision.id },
        },
      ]);
      return revision;
    });
  } catch (error) {
    await db
      .update(aiProcessingRuns)
      .set({
        status: "failed",
        errorCode:
          error instanceof ApiError
            ? error.code
            : "GAP_GUIDANCE_PERSISTENCE_FAILED",
        errorMessage: "Regenerated Gap guidance was not saved.",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(aiProcessingRuns.id, generated.runId),
          eq(aiProcessingRuns.status, "processing"),
        ),
      );
    throw error;
  }
}

async function correctGapRevisionLegacy(input: {
  userId: string;
  organizationId: string;
  sourceRevisionId: string;
  corrections: GapFindingCorrection[];
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  await assertGapFindingsMutable(input.organizationId);
  const sourceRevision = await db.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.id, input.sourceRevisionId)) ?? operators.sql`true` },
  });
  if (!sourceRevision?.gapAnalysisReleaseId) {
    throw new ApiError(
      404,
      "Gap result not found",
      undefined,
      "GAP_REVISION_NOT_FOUND",
    );
  }
  const sourceSnapshotLocale = readGapRevisionMetadata(
    sourceRevision.result,
  ).outputLocale;
  if (
    (sourceRevision.outputLocale !== "de" &&
      sourceRevision.outputLocale !== "en") ||
    sourceSnapshotLocale !== sourceRevision.outputLocale
  ) {
    throw new ApiError(
      409,
      "Gap result language metadata is invalid",
      undefined,
      "GAP_OUTPUT_LOCALE_INVALID",
    );
  }
  const artifact = await db.query.generatedArtifacts.findFirst({ columns: { id: true, organizationId: true, moduleId: true, artifactType: true, currentRevisionId: true, acceptedRevisionId: true, createdAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.id, sourceRevision.artifactId),
      eq(table.organizationId, input.organizationId),
      eq(table.artifactType, "gap_analysis_result"),
    )) ?? operators.sql`true` },
  });
  if (!artifact || artifact.currentRevisionId !== sourceRevision.id) {
    throw new ApiError(
      409,
      "A newer gap result is already current",
      undefined,
      "GAP_REVISION_NOT_CURRENT",
    );
  }
  if (input.corrections.length === 0) {
    throw new ApiError(
      400,
      "At least one change is required",
      undefined,
      "GAP_CORRECTION_REQUIRED",
    );
  }
  const correctionByFinding = new Map(
    input.corrections.map((correction) => [correction.findingId, correction]),
  );
  if (correctionByFinding.size !== input.corrections.length) {
    throw new ApiError(
      400,
      "Each finding may be changed only once",
      undefined,
      "GAP_CORRECTION_DUPLICATE",
    );
  }
  assertGapCorrectionReasons(input.corrections);
  const sourceFindings = await db.query.gapFindings.findMany({ columns: { id: true, artifactRevisionId: true, requirementVersionId: true, status: true, evidenceSufficiency: true, guidanceMode: true, guidanceBasis: true, guidanceBasisHash: true, severity: true, rationale: true, recommendation: true, objective: true, deliverables: true, acceptanceCriteria: true, suggestedEvidence: true, guidanceRunId: true, assumptions: true, requiresReview: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.artifactRevisionId, sourceRevision.id)) ?? operators.sql`true` },
  });
  if (
    input.corrections.some(
      (correction) =>
        !sourceFindings.some((finding) => finding.id === correction.findingId),
    )
  ) {
    throw new ApiError(
      404,
      "A changed finding was not found",
      undefined,
      "GAP_FINDING_NOT_FOUND",
    );
  }
  const sourceEvidence = sourceFindings.length
    ? await db.query.gapFindingEvidence.findMany({ columns: { id: true, findingId: true, citationId: true, sourceType: true, assessmentAnswerId: true, documentChunkId: true, legalSourceChunkId: true, excerpt: true, pageNumber: true, sectionLabel: true, createdAt: true },
        where: { RAW: (table, operators) => (inArray(
          table.findingId,
          sourceFindings.map((finding) => finding.id),
        )) ?? operators.sql`true` },
      })
    : [];
  const requirements = sourceFindings.length
    ? await db
        .select({
          id: gapRequirementVersions.id,
          code: gapRequirements.code,
          criticality: gapRequirementVersions.criticality,
        })
        .from(gapRequirementVersions)
        .innerJoin(
          gapRequirements,
          eq(gapRequirementVersions.requirementId, gapRequirements.id),
        )
        .where(
          inArray(
            gapRequirementVersions.id,
            sourceFindings.map((finding) => finding.requirementVersionId),
          ),
        )
    : [];
  const requirementById = new Map(requirements.map((item) => [item.id, item]));
  const [assessmentSources, artifactSources, documentSources] = await Promise.all([
    db.query.artifactRevisionAssessmentSources.findMany({
      where: { RAW: (table, operators) => (eq(table.artifactRevisionId, sourceRevision.id)) ?? operators.sql`true` },
      columns: { assessmentRevisionId: true },
    }),
    db.query.artifactRevisionArtifactSources.findMany({
      where: { RAW: (table, operators) => (eq(table.artifactRevisionId, sourceRevision.id)) ?? operators.sql`true` },
      columns: { sourceArtifactRevisionId: true },
    }),
    db.query.artifactRevisionDocumentSources.findMany({
      where: { RAW: (table, operators) => (eq(table.artifactRevisionId, sourceRevision.id)) ?? operators.sql`true` },
      columns: { documentVersionId: true },
    }),
  ]);
  const latest = await db.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.artifactId, artifact.id)) ?? operators.sql`true` },
    orderBy: { revisionNumber: "desc" },
  });

  try {
    return await db.transaction(async (tx) => {
      const [lockedArtifact] = await tx
        .select({
          currentRevisionId: generatedArtifacts.currentRevisionId,
        })
        .from(generatedArtifacts)
        .where(eq(generatedArtifacts.id, artifact.id))
        .limit(1)
        .for("update");
      if (lockedArtifact?.currentRevisionId !== sourceRevision.id) {
        throw new ApiError(
          409,
          "A newer gap result is already current",
          undefined,
          "GAP_REVISION_NOT_CURRENT",
        );
      }
      const activePlan = await tx.query.actionPlans.findFirst({ columns: { id: true, organizationId: true, sourceGapArtifactRevisionId: true, outputLocale: true, status: true, revisionNumber: true, activatedBy: true, activatedAt: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true, version: true },
        where: { RAW: (table, operators) => (and(
          eq(table.organizationId, input.organizationId),
          eq(table.status, "active"),
        )) ?? operators.sql`true` },
      });
      if (activePlan) {
        throw new ApiError(
          409,
          "The Gap Analysis is locked by its action plan",
          undefined,
          "GAP_LOCKED_BY_ACTION_PLAN",
        );
      }
      const revisedFindings = sourceFindings.map((source) => {
        const correction = correctionByFinding.get(source.id);
        const requirement = requirementById.get(source.requirementVersionId);
        if (!requirement)
          throw new ApiError(409, "Pinned requirement is missing");
        const resolved = resolveGapFindingCorrection({
          source,
          correction,
          criticality: requirement.criticality,
        });
        return {
          source,
          correction,
          ...resolved,
          rationale: source.rationale,
          recommendation: source.recommendation,
          assumptions: source.assumptions,
        };
      });
      const summary = buildCorrectedGapRevisionMetadata({
        source: sourceRevision.result,
        sourceRevisionId: sourceRevision.id,
        expectedRequirementVersionIds: revisedFindings.map(
          (finding) => finding.source.requirementVersionId,
        ),
        correctedRequirementVersionIds: revisedFindings
          .filter((finding) => finding.correction)
          .map((finding) => finding.source.requirementVersionId),
      });
      const [revision] = await tx
        .insert(generatedArtifactRevisions)
        .values({
          artifactId: artifact.id,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          parentRevisionId: sourceRevision.id,
          status: "reviewed",
          result: summary,
          outputLocale: sourceRevision.outputLocale,
          modelName: sourceRevision.modelName,
          promptVersion: sourceRevision.promptVersion,
          gapAnalysisReleaseId: sourceRevision.gapAnalysisReleaseId,
          evaluatorKind: sourceRevision.evaluatorKind,
          evaluatedAt: sourceRevision.evaluatedAt,
          inputHash: contentHash({
            parentInputHash: sourceRevision.inputHash,
            corrections: input.corrections,
          }),
          generatedBy: "user",
          createdBy: input.userId,
        })
        .returning();
      if (!revision)
        throw new ApiError(500, "Could not create corrected revision");
      if (assessmentSources.length) {
        await tx.insert(artifactRevisionAssessmentSources).values(
          assessmentSources.map((source) => ({
            artifactRevisionId: revision.id,
            assessmentRevisionId: source.assessmentRevisionId,
          })),
        );
      }
      if (artifactSources.length) {
        await tx.insert(artifactRevisionArtifactSources).values(
          artifactSources.map((source) => ({
            artifactRevisionId: revision.id,
            sourceArtifactRevisionId: source.sourceArtifactRevisionId,
          })),
        );
      }
      if (documentSources.length) {
        await tx.insert(artifactRevisionDocumentSources).values(
          documentSources.map((source) => ({
            artifactRevisionId: revision.id,
            documentVersionId: source.documentVersionId,
          })),
        );
      }
      for (const finding of revisedFindings) {
        const [created] = await tx
          .insert(gapFindings)
          .values({
            artifactRevisionId: revision.id,
            requirementVersionId: finding.source.requirementVersionId,
            status: finding.status,
            evidenceSufficiency: finding.evidenceSufficiency,
            guidanceMode: finding.source.guidanceMode,
            guidanceBasis: finding.source.guidanceBasis,
            guidanceBasisHash: finding.source.guidanceBasisHash,
            severity: finding.severity,
            rationale: finding.rationale,
            recommendation: finding.recommendation,
            objective: finding.source.objective,
            deliverables: finding.source.deliverables,
            acceptanceCriteria: finding.source.acceptanceCriteria,
            suggestedEvidence: finding.source.suggestedEvidence,
            guidanceRunId: finding.source.guidanceRunId,
            assumptions: finding.assumptions,
            requiresReview: finding.requiresReview,
          })
          .returning();
        if (!created)
          throw new ApiError(500, "Could not copy corrected finding");
        const evidence = sourceEvidence.filter(
          (item) => item.findingId === finding.source.id,
        );
        if (evidence.length > 0) {
          await tx
            .insert(gapFindingEvidence)
            .values(
              evidence.map((item) =>
                copyGapFindingEvidenceValues(item, created.id),
              ),
            );
        }
        if (finding.correction?.resolutionReason?.trim()) {
          await tx.insert(gapFindingReviewResolutions).values({
            artifactRevisionId: revision.id,
            findingId: created.id,
            reason: finding.correction.resolutionReason.trim(),
            resolvedBy: input.userId,
          });
        }
      }
      const [advanced] = await tx
        .update(generatedArtifacts)
        .set({ currentRevisionId: revision.id })
        .where(
          and(
            eq(generatedArtifacts.id, artifact.id),
            eq(generatedArtifacts.currentRevisionId, sourceRevision.id),
          ),
        )
        .returning({ id: generatedArtifacts.id });
      if (!advanced) {
        throw new ApiError(
          409,
          "A newer gap result is already current",
          undefined,
          "GAP_REVISION_NOT_CURRENT",
        );
      }
      await tx.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "gap_revision.corrected",
        entityType: "generated_artifact_revision",
        entityId: revision.id,
        metadata: {
          parentRevisionId: sourceRevision.id,
          reasons: input.corrections.map((correction) => correction.reason),
          findingIds: input.corrections.map(
            (correction) => correction.findingId,
          ),
        },
      });
      return revision;
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Could not persist corrected gap result", {
      organizationId: input.organizationId,
      sourceRevisionId: input.sourceRevisionId,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    throw new ApiError(
      500,
      "The assessment change could not be saved",
      undefined,
      "GAP_CORRECTION_PERSISTENCE_FAILED",
    );
  }
}

// Kept only as a source-compatible reference while old review tests exercise
// its pure helpers; production correction uses the regeneration path above.
void correctGapRevisionLegacy;

export async function approveGapRevision(input: {
  userId: string;
  organizationId: string;
  revisionId: string;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const revision = await db.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.id, input.revisionId)) ?? operators.sql`true` },
  });
  if (!revision?.gapAnalysisReleaseId) {
    throw new ApiError(
      404,
      "Gap result not found",
      undefined,
      "GAP_REVISION_NOT_FOUND",
    );
  }
  const revisionSnapshotLocale = readGapRevisionMetadata(
    revision.result,
  ).outputLocale;
  if (
    (revision.outputLocale !== "de" && revision.outputLocale !== "en") ||
    revisionSnapshotLocale !== revision.outputLocale
  ) {
    throw new ApiError(
      409,
      "Gap result language metadata is invalid",
      undefined,
      "GAP_OUTPUT_LOCALE_INVALID",
    );
  }
  const artifact = await db.query.generatedArtifacts.findFirst({ columns: { id: true, organizationId: true, moduleId: true, artifactType: true, currentRevisionId: true, acceptedRevisionId: true, createdAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.id, revision.artifactId),
      eq(table.organizationId, input.organizationId),
      eq(table.artifactType, "gap_analysis_result"),
    )) ?? operators.sql`true` },
  });
  if (!artifact || artifact.currentRevisionId !== revision.id) {
    throw new ApiError(
      409,
      "A newer gap result is already current",
      undefined,
      "GAP_REVISION_NOT_CURRENT",
    );
  }
  const assessmentSource = await db.query.artifactRevisionAssessmentSources.findFirst({
    where: { RAW: (table, operators) => (eq(table.artifactRevisionId, revision.id)) ?? operators.sql`true` },
    columns: { assessmentRevisionId: true },
  });
  if (!assessmentSource)
    throw new ApiError(409, "Gap revision assessment source is missing");
  const assessmentRevision = await db.query.assessmentRevisions.findFirst({ columns: { id: true, assessmentId: true, questionnaireVersionId: true, revisionNumber: true, parentRevisionId: true, status: true, createdBy: true, createdAt: true, submittedAt: true },
    where: { RAW: (table, operators) => (eq(table.id, assessmentSource.assessmentRevisionId)) ?? operators.sql`true` },
  });
  if (!assessmentRevision)
    throw new ApiError(409, "Gap assessment revision is missing");
  const assessment = await db.query.assessments.findFirst({ columns: { id: true, organizationId: true, moduleId: true, questionnaireId: true, checkReleaseId: true, gapAnalysisReleaseId: true, applicabilityArtifactRevisionId: true, currentRevisionId: true, status: true, createdBy: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.id, assessmentRevision.assessmentId)) ?? operators.sql`true` },
  });
  if (!assessment?.applicabilityArtifactRevisionId) {
    throw new ApiError(409, "Pinned applicability source is missing");
  }
  const applicability = await db.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(
      table.id,
      assessment.applicabilityArtifactRevisionId!,
    )) ?? operators.sql`true` },
  });
  const outcome = (applicability?.result as { outcome?: unknown })?.outcome;
  if (typeof outcome !== "string")
    throw new ApiError(409, "Applicability outcome is missing");
  const release = await loadGapAnalysisRelease(
    revision.gapAnalysisReleaseId,
    revision.outputLocale,
  );
  if (!release) throw new ApiError(409, "Pinned gap release is unavailable");
  const expectedRequirementVersionIds = release.requirements
    .filter((requirement) =>
      requirement.applicabilityOutcomeCodes.includes(outcome),
    )
    .map((requirement) => requirement.id);
  const findings = await db.query.gapFindings.findMany({ columns: { id: true, artifactRevisionId: true, requirementVersionId: true, status: true, evidenceSufficiency: true, severity: true, rationale: true, recommendation: true, assumptions: true, requiresReview: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.artifactRevisionId, revision.id)) ?? operators.sql`true` },
  });
  const evidence = findings.length
    ? await db.query.gapFindingEvidence.findMany({ columns: { id: true, findingId: true, citationId: true, sourceType: true, assessmentAnswerId: true, documentChunkId: true, legalSourceChunkId: true, excerpt: true, pageNumber: true, sectionLabel: true, createdAt: true },
        where: { RAW: (table, operators) => (inArray(
          table.findingId,
          findings.map((finding) => finding.id),
        )) ?? operators.sql`true` },
      })
    : [];
  assertGapRevisionApprovable({
    expectedRequirementVersionIds,
    findings,
    evidence,
  });
  const approvedAt = new Date();
  return db.transaction(async (tx) => {
    const [approved] = await tx
      .update(generatedArtifactRevisions)
      .set({
        status: "approved",
        approvedBy: input.userId,
        approvedAt,
      })
      .where(eq(generatedArtifactRevisions.id, revision.id))
      .returning();
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
        "A newer gap result became current before confirmation",
        undefined,
        "GAP_REVISION_NOT_CURRENT",
      );
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_revision.approved",
      entityType: "generated_artifact_revision",
      entityId: revision.id,
      metadata: {},
    });
    return approved;
  });
}

function isGuidanceAnswerValue(
  value: string | undefined,
): value is
  | "fully_implemented"
  | "partially_implemented"
  | "not_implemented"
  | "unsure"
  | "not_applicable" {
  return (
    value === "fully_implemented" ||
    value === "partially_implemented" ||
    value === "not_implemented" ||
    value === "unsure" ||
    value === "not_applicable"
  );
}
