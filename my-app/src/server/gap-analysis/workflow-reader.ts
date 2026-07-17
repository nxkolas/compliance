import { db } from "@/src/db";
import {
  actionPlans,
  aiProcessingRuns,
  assessmentAnswerOptions,
  assessmentAnswers,
  assessments,
  gapFindingEvidence,
  gapFindings,
  gapRequirementVersions,
  generatedArtifactRevisions,
  generatedArtifacts,
  organizationMemberships,
  questionOptions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getOrganizationDocumentLibrary } from "../documents/service";
import { assertCanAccessOrganization } from "../organizations/service";
import { getActiveGapAnalysisRelease } from "./release-loader";
import { getGapReassessmentDraft } from "./reassessment-service";
import { getGapRevisionStaleness } from "./staleness";
import { selectGapWorkflowRevisions } from "./workflow-state";

export async function getGapAnalysisWorkflow(input: {
  userId: string;
  organizationId: string;
  locale: Locale;
}) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  const membership = await db.query.organizationMemberships.findFirst({
    where: and(
      eq(organizationMemberships.organizationId, input.organizationId),
      eq(organizationMemberships.userId, input.userId),
      eq(organizationMemberships.status, "active"),
    ),
  });
  const permissions = {
    role: membership?.role ?? "auditor" as const,
    canContribute: membership?.role !== "auditor",
    canManage: membership?.role === "owner" || membership?.role === "admin",
  };
  const documentLibrary = await getOrganizationDocumentLibrary(
    input.userId,
    input.organizationId,
  );
  const release = await getActiveGapAnalysisRelease("nis2-gap", input.locale);
  if (!release) {
    return {
      ...permissions,
      release: null,
      assessment: null,
      answers: {},
      documents: currentDocumentRows(documentLibrary),
      documentLibrary,
      run: null,
      revision: null,
      findings: [],
      acceptedRevision: null,
      acceptedFindings: [],
      candidateRevision: null,
      candidateFindings: [],
      reassessment: null,
      reviewBlockers: [],
      planUpdateAvailable: false,
      acceptedStaleness: null,
      candidateStaleness: null,
      staleness: null,
    };
  }
  const assessment = await db.query.assessments.findFirst({
    where: and(
      eq(assessments.organizationId, input.organizationId),
      eq(assessments.moduleId, release.moduleId),
      eq(assessments.gapAnalysisReleaseId, release.id),
      eq(assessments.status, "active"),
    ),
  });
  const answerRows = assessment?.currentRevisionId
    ? await db.query.assessmentAnswers.findMany({
        where: eq(assessmentAnswers.assessmentRevisionId, assessment.currentRevisionId),
      })
    : [];
  const answerOptions = answerRows.length
    ? await db
        .select({
          answerId: assessmentAnswerOptions.assessmentAnswerId,
          optionId: questionOptions.id,
        })
        .from(assessmentAnswerOptions)
        .innerJoin(
          questionOptions,
          eq(assessmentAnswerOptions.questionOptionId, questionOptions.id),
        )
        .where(
          inArray(
            assessmentAnswerOptions.assessmentAnswerId,
            answerRows.map((answer) => answer.id),
          ),
        )
    : [];
  const artifact = await db.query.generatedArtifacts.findFirst({
    where: and(
      eq(generatedArtifacts.organizationId, input.organizationId),
      eq(generatedArtifacts.moduleId, release.moduleId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ),
  });
  const acceptedRevision = artifact?.acceptedRevisionId
    ? await db.query.generatedArtifactRevisions.findFirst({
        where: and(
          eq(generatedArtifactRevisions.id, artifact.acceptedRevisionId),
          eq(generatedArtifactRevisions.artifactId, artifact.id),
          eq(generatedArtifactRevisions.status, "approved"),
        ),
      })
    : null;
  const workingRevision = artifact?.currentRevisionId
    ? await db.query.generatedArtifactRevisions.findFirst({
        where: eq(generatedArtifactRevisions.id, artifact.currentRevisionId),
      })
    : null;
  const { candidate: candidateRevision } = selectGapWorkflowRevisions<
    typeof generatedArtifactRevisions.$inferSelect
  >({
    current: workingRevision ?? null,
    accepted: acceptedRevision ?? null,
  });
  const [acceptedFindings, candidateFindings] = await Promise.all([
    loadFindings(acceptedRevision?.id),
    loadFindings(candidateRevision?.id),
  ]);
  const reassessment = assessment
    ? await getGapReassessmentDraft({
        userId: input.userId,
        organizationId: input.organizationId,
        assessmentId: assessment.id,
        locale: input.locale,
      })
    : null;
  const run = reassessment?.draft.aiProcessingRunId
    ? await db.query.aiProcessingRuns.findFirst({
        where: eq(aiProcessingRuns.id, reassessment.draft.aiProcessingRunId),
      })
    : assessment?.currentRevisionId
      ? await db.query.aiProcessingRuns.findFirst({
          where: and(
            eq(aiProcessingRuns.organizationId, input.organizationId),
            eq(aiProcessingRuns.assessmentRevisionId, assessment.currentRevisionId),
            eq(aiProcessingRuns.operationKind, "gap_analysis"),
          ),
          orderBy: [desc(aiProcessingRuns.createdAt)],
        })
      : null;
  const [acceptedStaleness, candidateStaleness] = await Promise.all([
    acceptedRevision
      ? getGapRevisionStaleness({
          userId: input.userId,
          organizationId: input.organizationId,
          revisionId: acceptedRevision.id,
        })
      : null,
    candidateRevision
      ? getGapRevisionStaleness({
          userId: input.userId,
          organizationId: input.organizationId,
          revisionId: candidateRevision.id,
        })
      : null,
  ]);
  const activePlan = await db.query.actionPlans.findFirst({
    where: and(
      eq(actionPlans.organizationId, input.organizationId),
      eq(actionPlans.status, "active"),
    ),
  });
  const revision = candidateRevision ?? acceptedRevision;
  const findings = candidateRevision ? candidateFindings : acceptedFindings;

  return {
    ...permissions,
    release,
    assessment,
    answers: Object.fromEntries(
      answerRows.map((answer) => [
        answer.questionId,
        answerOptions.find((option) => option.answerId === answer.id)?.optionId ?? "",
      ]),
    ),
    documents: currentDocumentRows(documentLibrary),
    documentLibrary,
    run,
    revision,
    findings,
    acceptedRevision,
    acceptedFindings,
    candidateRevision,
    candidateFindings,
    reassessment,
    reviewBlockers: candidateFindings
      .filter((row) => row.finding.requiresReview)
      .map((row) => row.finding.id),
    planUpdateAvailable: Boolean(
      activePlan &&
        acceptedRevision &&
        activePlan.sourceGapArtifactRevisionId !== acceptedRevision.id,
    ),
    acceptedStaleness,
    candidateStaleness,
    staleness: candidateRevision ? candidateStaleness : acceptedStaleness,
  };
}

async function loadFindings(revisionId: string | null | undefined) {
  if (!revisionId) return [];
  const findingRows = await db
    .select({ finding: gapFindings, requirement: gapRequirementVersions })
    .from(gapFindings)
    .innerJoin(
      gapRequirementVersions,
      eq(gapFindings.requirementVersionId, gapRequirementVersions.id),
    )
    .where(eq(gapFindings.artifactRevisionId, revisionId));
  const evidenceRows = findingRows.length
    ? await db.query.gapFindingEvidence.findMany({
        where: inArray(
          gapFindingEvidence.findingId,
          findingRows.map((row) => row.finding.id),
        ),
      })
    : [];
  return findingRows.map((row) => ({
    ...row,
    evidence: evidenceRows.filter(
      (evidence) => evidence.findingId === row.finding.id,
    ),
  }));
}

function currentDocumentRows(
  library: Awaited<ReturnType<typeof getOrganizationDocumentLibrary>>,
) {
  return library.documents.map((entry) => {
    const current = entry.versions.find(
      (item) => item.version.id === entry.document.currentVersionId,
    );
    return {
      document: entry.document,
      version: current?.version ?? null,
      extraction: current?.extraction ?? null,
      embedding: current?.embedding ?? null,
    };
  });
}
