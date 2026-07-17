import { db } from "@/src/db";
import {
  aiProcessingRuns,
  assessmentAnswerOptions,
  assessmentAnswers,
  assessments,
  documentEmbeddingGenerations,
  documentExtractions,
  documentVersions,
  documents,
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
import { assertCanAccessOrganization } from "../organizations/service";
import { getGapRevisionStaleness } from "./staleness";
import { getActiveGapAnalysisRelease } from "./release-loader";

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
  const release = await getActiveGapAnalysisRelease("nis2-gap", input.locale);
  if (!release) {
    return {
      role: membership?.role ?? "auditor",
      canContribute: membership?.role !== "auditor",
      canManage: membership?.role === "owner" || membership?.role === "admin",
      release: null,
      assessment: null,
      answers: {},
      documents: [],
      run: null,
      revision: null,
      findings: [],
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
        where: eq(
          assessmentAnswers.assessmentRevisionId,
          assessment.currentRevisionId,
        ),
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
  const documentRows = await db
    .select({
      document: documents,
      version: documentVersions,
      extraction: documentExtractions,
      embedding: documentEmbeddingGenerations,
    })
    .from(documents)
    .leftJoin(documentVersions, eq(documents.currentVersionId, documentVersions.id))
    .leftJoin(
      documentExtractions,
      eq(documentExtractions.documentVersionId, documentVersions.id),
    )
    .leftJoin(
      documentEmbeddingGenerations,
      eq(documentEmbeddingGenerations.extractionId, documentExtractions.id),
    )
    .where(eq(documents.organizationId, input.organizationId))
    .orderBy(desc(documents.createdAt));
  const artifact = await db.query.generatedArtifacts.findFirst({
    where: and(
      eq(generatedArtifacts.organizationId, input.organizationId),
      eq(generatedArtifacts.moduleId, release.moduleId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ),
  });
  const revision = artifact?.currentRevisionId
    ? await db.query.generatedArtifactRevisions.findFirst({
        where: eq(generatedArtifactRevisions.id, artifact.currentRevisionId),
      })
    : null;
  const findingRows = revision
    ? await db
        .select({ finding: gapFindings, requirement: gapRequirementVersions })
        .from(gapFindings)
        .innerJoin(
          gapRequirementVersions,
          eq(gapFindings.requirementVersionId, gapRequirementVersions.id),
        )
        .where(eq(gapFindings.artifactRevisionId, revision.id))
    : [];
  const evidenceRows = findingRows.length
    ? await db.query.gapFindingEvidence.findMany({
        where: inArray(
          gapFindingEvidence.findingId,
          findingRows.map((row) => row.finding.id),
        ),
      })
    : [];
  const run = assessment?.currentRevisionId
    ? await db.query.aiProcessingRuns.findFirst({
        where: and(
          eq(aiProcessingRuns.organizationId, input.organizationId),
          eq(
            aiProcessingRuns.assessmentRevisionId,
            assessment.currentRevisionId,
          ),
          eq(aiProcessingRuns.operationKind, "gap_analysis"),
        ),
        orderBy: [desc(aiProcessingRuns.createdAt)],
      })
    : null;
  const staleness = revision
    ? await getGapRevisionStaleness({
        userId: input.userId,
        organizationId: input.organizationId,
        revisionId: revision.id,
      })
    : null;

  return {
    role: membership?.role ?? "auditor",
    canContribute: membership?.role !== "auditor",
    canManage: membership?.role === "owner" || membership?.role === "admin",
    release,
    assessment,
    answers: Object.fromEntries(
      answerRows.map((answer) => [
        answer.questionId,
        answerOptions.find((option) => option.answerId === answer.id)?.optionId ?? "",
      ]),
    ),
    documents: documentRows,
    run,
    revision,
    findings: findingRows.map((row) => ({
      ...row,
      evidence: evidenceRows.filter(
        (evidence) => evidence.findingId === row.finding.id,
      ),
    })),
    staleness,
  };
}
