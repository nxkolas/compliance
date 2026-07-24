import { db } from "@/src/db";
import {
  activeGapAnalysisReleases,
  assessments,
  auditEvents,
  gapAnalysisReleases,
  generatedArtifactRevisions,
  generatedArtifacts,
  questionnaireVersions,
} from "@/src/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { assertCanContributeToOrganization } from "../organizations/service";

export type ApplicabilityArtifactCandidate = {
  id: string;
  checkReleaseId: string | null;
  status: string;
};

export function requireApprovedApplicabilityArtifact(
  compatibleCheckReleaseId: string,
  candidates: ApplicabilityArtifactCandidate[],
) {
  const match = candidates.find(
    (candidate) =>
      candidate.checkReleaseId === compatibleCheckReleaseId &&
      candidate.status === "approved",
  );
  if (!match) {
    throw new ApiError(
      409,
      "An approved applicability result for the compatible release is required",
    );
  }
  return match;
}

export async function createOrOpenGapAssessment(
  userId: string,
  organizationId: string,
  releaseCode = "nis2-gap",
) {
  await assertCanContributeToOrganization(userId, organizationId);
  const active = await db.query.activeGapAnalysisReleases.findFirst({ columns: { releaseCode: true, gapAnalysisReleaseId: true, activatedBy: true, activatedAt: true },
    where: eq(activeGapAnalysisReleases.releaseCode, releaseCode),
  });
  if (!active) throw new ApiError(503, "No active gap-analysis release");
  const release = await db.query.gapAnalysisReleases.findFirst({ columns: { id: true, releaseCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, requirementSetVersionId: true, compatibleCheckReleaseId: true, promptName: true, promptVersion: true, promptTemplateHash: true, responseSchemaVersion: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
    where: eq(gapAnalysisReleases.id, active.gapAnalysisReleaseId),
  });
  if (!release || release.status !== "published") {
    throw new ApiError(503, "The active gap-analysis release is unavailable");
  }
  const questionnaireVersion = await db.query.questionnaireVersions.findFirst({ columns: { id: true, questionnaireId: true, versionLabel: true, titleContentRevisionId: true, status: true, createdAt: true, publishedAt: true },
    where: eq(questionnaireVersions.id, release.questionnaireVersionId),
  });
  if (!questionnaireVersion) {
    throw new ApiError(503, "The gap-analysis questionnaire is unavailable");
  }
  const existing = await db.query.assessments.findFirst({ columns: { id: true, organizationId: true, moduleId: true, questionnaireId: true, checkReleaseId: true, gapAnalysisReleaseId: true, applicabilityArtifactRevisionId: true, currentRevisionId: true, status: true, createdBy: true, createdAt: true },
    where: and(
      eq(assessments.organizationId, organizationId),
      eq(assessments.moduleId, release.moduleId),
      eq(assessments.gapAnalysisReleaseId, release.id),
      eq(assessments.status, "active"),
    ),
  });
  if (existing) return existing;

  const applicabilityCandidates = await db
    .select({
      id: generatedArtifactRevisions.id,
      checkReleaseId: generatedArtifactRevisions.checkReleaseId,
      status: generatedArtifactRevisions.status,
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

  return db.transaction(async (tx) => {
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
        applicabilityArtifactRevisionId: applicability.id,
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
        applicabilityArtifactRevisionId: applicability.id,
      },
    });
    return assessment;
  });
}

export async function getGapAssessment(userId: string, organizationId: string, assessmentId: string) {
  await assertCanContributeToOrganization(userId, organizationId);
  const assessment = await db.query.assessments.findFirst({ columns: { id: true, organizationId: true, moduleId: true, questionnaireId: true, checkReleaseId: true, gapAnalysisReleaseId: true, applicabilityArtifactRevisionId: true, currentRevisionId: true, status: true, createdBy: true, createdAt: true }, where: and(
    eq(assessments.id, assessmentId), eq(assessments.organizationId, organizationId),
  ) });
  if (!assessment) throw new ApiError(404, "Gap assessment not found", undefined, "GAP_ASSESSMENT_NOT_FOUND");
  return assessment;
}
