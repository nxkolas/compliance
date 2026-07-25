import { db } from "@/src/db";
import { artifactRevisionArtifactSources, artifactRevisionAssessmentSources, artifactRevisionDocumentSources, auditEvents, gapFindingEvidence, gapFindingReviewResolutions, gapFindings, gapRequirements, gapRequirementVersions, generatedArtifactRevisions, generatedArtifacts } from "@/src/db/schema";
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
  rationale?: string;
  recommendation?: string;
  assumptions?: string[];
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
  const sourceFindings = await db.query.gapFindings.findMany({ columns: { id: true, artifactRevisionId: true, requirementVersionId: true, status: true, evidenceSufficiency: true, severity: true, rationale: true, recommendation: true, assumptions: true, requiresReview: true, createdAt: true },
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
          rationale: correction?.rationale ?? source.rationale,
          recommendation: correction?.recommendation ?? source.recommendation,
          assumptions: correction?.assumptions ?? source.assumptions,
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
            severity: finding.severity,
            rationale: finding.rationale,
            recommendation: finding.recommendation,
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
