import { db } from "@/src/db";
import {
  assessments,
  auditEvents,
  generatedArtifactRevisions,
  generatedArtifacts,
} from "@/src/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { assertCanContributeToOrganization } from "../organizations/service";
import {
  assertGapApplicabilityEligible,
  evaluateGapApplicabilityPrerequisite,
  type GapApplicabilityArtifactCandidate,
} from "./applicability-eligibility";
import { createOrOpenQuestionnaireDraft } from "./questionnaire-draft-service";

export function requireApprovedApplicabilityArtifact(
  compatibleCheckReleaseId: string,
  candidates: GapApplicabilityArtifactCandidate[],
) {
  const candidate = candidates[0] ?? null;
  return assertGapApplicabilityEligible(
    evaluateGapApplicabilityPrerequisite(compatibleCheckReleaseId, candidate),
  );
}

export async function createOrOpenGapAssessment(
  userId: string,
  organizationId: string,
  releaseCode = "nis2-gap",
  options?: { publishedReleaseIdForQa?: string },
) {
  await assertCanContributeToOrganization(userId, organizationId);
  const active = options?.publishedReleaseIdForQa
    ? null
    : await db.query.activeGapAnalysisReleases.findFirst({
        columns: {
          releaseCode: true,
          gapAnalysisReleaseId: true,
          activatedBy: true,
          activatedAt: true,
        },
        where: {
          RAW: (table, operators) =>
            eq(table.releaseCode, releaseCode) ?? operators.sql`true`,
        },
      });
  const releaseId =
    options?.publishedReleaseIdForQa ?? active?.gapAnalysisReleaseId;
  if (!releaseId) {
    throw new ApiError(503, "No active gap-analysis release");
  }
  const release = await db.query.gapAnalysisReleases.findFirst({
    columns: {
      id: true,
      releaseCode: true,
      versionLabel: true,
      moduleId: true,
      questionnaireId: true,
      questionnaireVersionId: true,
      requirementSetVersionId: true,
      compatibleCheckReleaseId: true,
      promptName: true,
      promptVersion: true,
      promptTemplateHash: true,
      responseSchemaVersion: true,
      evaluatorKind: true,
      evaluatorVersion: true,
      defaultLocale: true,
      status: true,
      aggregateHash: true,
      corpusReleaseSetHash: true,
      publishedAt: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) => eq(table.id, releaseId) ?? operators.sql`true`,
    },
  });
  if (
    !release ||
    release.status !== "published" ||
    release.releaseCode !== releaseCode
  ) {
    throw new ApiError(503, "The active gap-analysis release is unavailable");
  }
  const questionnaireVersion = await db.query.questionnaireVersions.findFirst({
    columns: {
      id: true,
      questionnaireId: true,
      versionLabel: true,
      titleContentRevisionId: true,
      status: true,
      createdAt: true,
      publishedAt: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.id, release.questionnaireVersionId) ?? operators.sql`true`,
    },
  });
  if (!questionnaireVersion) {
    throw new ApiError(503, "The gap-analysis questionnaire is unavailable");
  }
  const applicabilityCandidates = await db
    .select({
      id: generatedArtifactRevisions.id,
      checkReleaseId: generatedArtifactRevisions.checkReleaseId,
      status: generatedArtifactRevisions.status,
      result: generatedArtifactRevisions.result,
    })
    .from(generatedArtifacts)
    .innerJoin(
      generatedArtifactRevisions,
      eq(generatedArtifacts.currentRevisionId, generatedArtifactRevisions.id),
    )
    .where(
      and(
        eq(generatedArtifacts.organizationId, organizationId),
        eq(generatedArtifacts.artifactType, "affectedness_result"),
      ),
    );
  const applicability = requireApprovedApplicabilityArtifact(
    release.compatibleCheckReleaseId,
    applicabilityCandidates,
  );
  const existing = await db.query.assessments.findFirst({
    columns: {
      id: true,
      organizationId: true,
      moduleId: true,
      questionnaireId: true,
      checkReleaseId: true,
      gapAnalysisReleaseId: true,
      applicabilityArtifactRevisionId: true,
      currentRevisionId: true,
      status: true,
      createdBy: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, organizationId),
          eq(table.moduleId, release.moduleId),
          eq(table.gapAnalysisReleaseId, release.id),
          eq(table.status, "active"),
        ) ?? operators.sql`true`,
    },
  });
  if (existing) {
    await createOrOpenQuestionnaireDraft({
      userId,
      organizationId,
      assessment: existing,
      questionnaireVersionId: release.questionnaireVersionId,
    });
    return existing;
  }

  const assessment = await db.transaction(async (tx) => {
    await tx
      .update(assessments)
      .set({ status: "archived" })
      .where(
        and(
          eq(assessments.organizationId, organizationId),
          eq(assessments.moduleId, release.moduleId),
          eq(assessments.status, "active"),
          ne(assessments.gapAnalysisReleaseId, release.id),
        ),
      );
    const [assessment] = await tx
      .insert(assessments)
      .values({
        organizationId,
        moduleId: release.moduleId,
        questionnaireId: questionnaireVersion.questionnaireId,
        gapAnalysisReleaseId: release.id,
        applicabilityArtifactRevisionId: applicability.artifactRevisionId,
        createdBy: userId,
      })
      .returning();
    if (!assessment) throw new ApiError(500, "Could not create gap assessment");
    await tx.insert(auditEvents).values({
      organizationId,
      actorUserId: userId,
      eventType: "gap_assessment.created",
      entityType: "assessment",
      entityId: assessment.id,
      metadata: {
        gapAnalysisReleaseId: release.id,
        applicabilityArtifactRevisionId: applicability.artifactRevisionId,
      },
    });
    return assessment;
  });
  await createOrOpenQuestionnaireDraft({
    userId,
    organizationId,
    assessment,
    questionnaireVersionId: release.questionnaireVersionId,
  });
  return assessment;
}

export async function getGapAssessment(
  userId: string,
  organizationId: string,
  assessmentId: string,
) {
  await assertCanContributeToOrganization(userId, organizationId);
  const assessment = await db.query.assessments.findFirst({
    columns: {
      id: true,
      organizationId: true,
      moduleId: true,
      questionnaireId: true,
      checkReleaseId: true,
      gapAnalysisReleaseId: true,
      applicabilityArtifactRevisionId: true,
      currentRevisionId: true,
      status: true,
      createdBy: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, assessmentId),
          eq(table.organizationId, organizationId),
        ) ?? operators.sql`true`,
    },
  });
  if (!assessment)
    throw new ApiError(
      404,
      "Gap assessment not found",
      undefined,
      "GAP_ASSESSMENT_NOT_FOUND",
    );
  return assessment;
}
