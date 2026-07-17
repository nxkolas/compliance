import { db } from "@/src/db";
import {
  artifactRevisionSources,
  assessmentRevisions,
  assessments,
  auditEvents,
  gapFindingEvidence,
  gapFindingReviewResolutions,
  gapFindings,
  gapRequirementVersions,
  generatedArtifactRevisions,
  generatedArtifacts,
} from "@/src/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contentHash } from "../compliance/publishing/canonical-json";
import { ApiError } from "../api/errors";
import { assertCanManageOrganization } from "../organizations/service";
import { deriveFindingSeverity } from "./generation-schema";
import { loadGapAnalysisRelease } from "./release-loader";

type LocalizedText = { de: string; en: string };

export type FindingApprovalSnapshot = {
  id: string;
  requirementVersionId: string;
  status: "fulfilled" | "partially_fulfilled" | "not_fulfilled" | "insufficient_evidence";
  requiresReview: boolean;
};

export function assertGapRevisionApprovable(input: {
  expectedRequirementVersionIds: string[];
  findings: FindingApprovalSnapshot[];
  evidence: Array<{
    findingId: string;
    citationId: string;
    sourceType: "assessment_answer" | "document_chunk";
  }>;
}) {
  const expected = new Set(input.expectedRequirementVersionIds);
  const actual = new Set(input.findings.map((finding) => finding.requirementVersionId));
  if (
    actual.size !== input.findings.length ||
    actual.size !== expected.size ||
    [...expected].some((id) => !actual.has(id))
  ) {
    throw new ApiError(409, "Gap finding coverage is incomplete");
  }
  for (const finding of input.findings) {
    if (finding.requiresReview) {
      throw new ApiError(409, "Resolve all review blockers before approval");
    }
    const citations = input.evidence.filter(
      (evidence) => evidence.findingId === finding.id,
    );
    if (citations.some((citation) => !citation.citationId.trim())) {
      throw new ApiError(409, "A finding contains an invalid citation");
    }
    if (
      finding.status === "fulfilled" &&
      !citations.some((citation) => citation.sourceType === "document_chunk")
    ) {
      throw new ApiError(409, "Fulfilled findings require documentary evidence");
    }
  }
}

export async function correctGapRevision(input: {
  userId: string;
  organizationId: string;
  sourceRevisionId: string;
  corrections: Array<{
    findingId: string;
    status?: FindingApprovalSnapshot["status"];
    evidenceSufficiency?: "sufficient" | "partial" | "none";
    rationale?: LocalizedText;
    recommendation?: LocalizedText;
    assumptions?: string[];
    requiresReview?: boolean;
    reason: string;
    resolutionReason?: string;
  }>;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const sourceRevision = await db.query.generatedArtifactRevisions.findFirst({
    where: eq(generatedArtifactRevisions.id, input.sourceRevisionId),
  });
  if (!sourceRevision?.gapAnalysisReleaseId) {
    throw new ApiError(404, "Gap revision not found");
  }
  const artifact = await db.query.generatedArtifacts.findFirst({
    where: and(
      eq(generatedArtifacts.id, sourceRevision.artifactId),
      eq(generatedArtifacts.organizationId, input.organizationId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ),
  });
  if (!artifact || artifact.currentRevisionId !== sourceRevision.id) {
    throw new ApiError(409, "Only the current gap revision can be corrected");
  }
  if (input.corrections.length === 0) {
    throw new ApiError(400, "At least one correction is required");
  }
  const correctionByFinding = new Map(
    input.corrections.map((correction) => [correction.findingId, correction]),
  );
  if (correctionByFinding.size !== input.corrections.length) {
    throw new ApiError(400, "Each finding may be corrected only once");
  }
  for (const correction of input.corrections) {
    if (!correction.reason.trim()) {
      throw new ApiError(400, "Every correction requires a reason");
    }
  }
  const sourceFindings = await db.query.gapFindings.findMany({
    where: eq(gapFindings.artifactRevisionId, sourceRevision.id),
  });
  if (
    input.corrections.some(
      (correction) =>
        !sourceFindings.some((finding) => finding.id === correction.findingId),
    )
  ) {
    throw new ApiError(404, "A corrected finding was not found");
  }
  const sourceEvidence = sourceFindings.length
    ? await db.query.gapFindingEvidence.findMany({
        where: inArray(
          gapFindingEvidence.findingId,
          sourceFindings.map((finding) => finding.id),
        ),
      })
    : [];
  const requirements = sourceFindings.length
    ? await db.query.gapRequirementVersions.findMany({
        where: inArray(
          gapRequirementVersions.id,
          sourceFindings.map((finding) => finding.requirementVersionId),
        ),
      })
    : [];
  const requirementById = new Map(requirements.map((item) => [item.id, item]));
  const sources = await db.query.artifactRevisionSources.findMany({
    where: eq(artifactRevisionSources.artifactRevisionId, sourceRevision.id),
  });
  const latest = await db.query.generatedArtifactRevisions.findFirst({
    where: eq(generatedArtifactRevisions.artifactId, artifact.id),
    orderBy: [desc(generatedArtifactRevisions.revisionNumber)],
  });

  return db.transaction(async (tx) => {
    const revisedFindings = sourceFindings.map((source) => {
      const correction = correctionByFinding.get(source.id);
      const status = correction?.status ?? source.status;
      const requiresReview = correction?.requiresReview ?? source.requiresReview;
      if (
        source.requiresReview &&
        !requiresReview &&
        !correction?.resolutionReason?.trim()
      ) {
        throw new ApiError(400, "Clearing a review blocker requires a resolution reason");
      }
      const requirement = requirementById.get(source.requirementVersionId);
      if (!requirement) throw new ApiError(409, "Pinned requirement is missing");
      return {
        source,
        correction,
        status,
        requiresReview,
        evidenceSufficiency:
          correction?.evidenceSufficiency ?? source.evidenceSufficiency,
        rationale: correction?.rationale ?? source.rationale,
        recommendation: correction?.recommendation ?? source.recommendation,
        assumptions: correction?.assumptions ?? source.assumptions,
        severity: deriveFindingSeverity(requirement.criticality, status),
      };
    });
    for (const finding of revisedFindings) {
      if (
        finding.status === "fulfilled" &&
        !sourceEvidence.some(
          (evidence) =>
            evidence.findingId === finding.source.id &&
            evidence.sourceType === "document_chunk",
        )
      ) {
        throw new ApiError(400, "A correction cannot mark questionnaire-only evidence fulfilled");
      }
    }
    const summary = {
      ...(sourceRevision.result as Record<string, unknown>),
      correctedFromRevisionId: sourceRevision.id,
      findings: revisedFindings.map((finding) => ({
        requirementVersionId: finding.source.requirementVersionId,
        status: finding.status,
        evidenceSufficiency: finding.evidenceSufficiency,
        severity: finding.severity,
        rationale: finding.rationale,
        recommendation: finding.recommendation,
        assumptions: finding.assumptions,
        requiresReview: finding.requiresReview,
      })),
    };
    const [revision] = await tx
      .insert(generatedArtifactRevisions)
      .values({
        artifactId: artifact.id,
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        parentRevisionId: sourceRevision.id,
        status: "reviewed",
        result: summary,
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
    if (!revision) throw new ApiError(500, "Could not create corrected revision");
    if (sources.length > 0) {
      await tx.insert(artifactRevisionSources).values(
        sources.map((source) => ({
          artifactRevisionId: revision.id,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
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
      if (!created) throw new ApiError(500, "Could not copy corrected finding");
      const evidence = sourceEvidence.filter(
        (item) => item.findingId === finding.source.id,
      );
      if (evidence.length > 0) {
        await tx.insert(gapFindingEvidence).values(
          evidence.map((item) => ({
            findingId: created.id,
            citationId: item.citationId,
            sourceType: item.sourceType,
            assessmentAnswerId: item.assessmentAnswerId,
            documentChunkId: item.documentChunkId,
            excerpt: item.excerpt,
            pageNumber: item.pageNumber,
            sectionLabel: item.sectionLabel,
          })),
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
    await tx
      .update(generatedArtifacts)
      .set({ currentRevisionId: revision.id })
      .where(eq(generatedArtifacts.id, artifact.id));
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_revision.corrected",
      entityType: "generated_artifact_revision",
      entityId: revision.id,
      metadata: {
        parentRevisionId: sourceRevision.id,
        reasons: input.corrections.map((correction) => correction.reason),
      },
    });
    return revision;
  });
}

export async function approveGapRevision(input: {
  userId: string;
  organizationId: string;
  revisionId: string;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const revision = await db.query.generatedArtifactRevisions.findFirst({
    where: eq(generatedArtifactRevisions.id, input.revisionId),
  });
  if (!revision?.gapAnalysisReleaseId) throw new ApiError(404, "Gap revision not found");
  const artifact = await db.query.generatedArtifacts.findFirst({
    where: and(
      eq(generatedArtifacts.id, revision.artifactId),
      eq(generatedArtifacts.organizationId, input.organizationId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ),
  });
  if (!artifact || artifact.currentRevisionId !== revision.id) {
    throw new ApiError(409, "Only the current gap revision can be approved");
  }
  const assessmentSource = await db.query.artifactRevisionSources.findFirst({
    where: and(
      eq(artifactRevisionSources.artifactRevisionId, revision.id),
      eq(artifactRevisionSources.sourceType, "assessment_revision"),
    ),
  });
  if (!assessmentSource) throw new ApiError(409, "Gap revision assessment source is missing");
  const assessmentRevision = await db.query.assessmentRevisions.findFirst({
    where: eq(assessmentRevisions.id, assessmentSource.sourceId),
  });
  if (!assessmentRevision) throw new ApiError(409, "Gap assessment revision is missing");
  const assessment = await db.query.assessments.findFirst({
    where: eq(assessments.id, assessmentRevision.assessmentId),
  });
  if (!assessment?.applicabilityArtifactRevisionId) {
    throw new ApiError(409, "Pinned applicability source is missing");
  }
  const applicability = await db.query.generatedArtifactRevisions.findFirst({
    where: eq(
      generatedArtifactRevisions.id,
      assessment.applicabilityArtifactRevisionId,
    ),
  });
  const outcome = (applicability?.result as { outcome?: unknown })?.outcome;
  if (typeof outcome !== "string") throw new ApiError(409, "Applicability outcome is missing");
  const release = await loadGapAnalysisRelease(revision.gapAnalysisReleaseId, "de");
  if (!release) throw new ApiError(409, "Pinned gap release is unavailable");
  const expectedRequirementVersionIds = release.requirements
    .filter((requirement) => requirement.applicabilityOutcomeCodes.includes(outcome))
    .map((requirement) => requirement.id);
  const findings = await db.query.gapFindings.findMany({
    where: eq(gapFindings.artifactRevisionId, revision.id),
  });
  const evidence = findings.length
    ? await db.query.gapFindingEvidence.findMany({
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
      throw new ApiError(409, "A newer gap revision became current before approval");
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
