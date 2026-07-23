import { db } from "@/src/db";
import {
  artifactRevisionSources,
  assessmentAnswerOptions,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  documents,
  documentVersions,
  generatedArtifactRevisions,
  generatedArtifacts,
  questionOptions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { loadGapAnalysisRelease } from "./release-loader";

type FrozenAnswerValue = {
  optionLabels: string[];
  textValue: string | null;
  numberValue: string | null;
  booleanValue: boolean | null;
  dateValue: string | null;
  structuredValue: unknown;
};

export function formatFrozenAnswer(
  value: FrozenAnswerValue,
  locale: Locale = "en",
) {
  if (value.optionLabels.length) return value.optionLabels.join(", ");
  if (value.textValue) return value.textValue;
  if (value.numberValue !== null) return value.numberValue;
  if (value.booleanValue !== null) {
    return value.booleanValue
      ? locale === "de"
        ? "Ja"
        : "Yes"
      : locale === "de"
        ? "Nein"
        : "No";
  }
  if (value.dateValue) return value.dateValue;
  if (value.structuredValue !== null) {
    return JSON.stringify(value.structuredValue);
  }
  return "";
}

export async function readGeneratedGapInputs(input: {
  organizationId: string;
  revisionId: string;
  locale: Locale;
}) {
  const [owner] = await db
    .select({ revision: generatedArtifactRevisions })
    .from(generatedArtifactRevisions)
    .innerJoin(
      generatedArtifacts,
      eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id),
    )
    .where(
      and(
        eq(generatedArtifactRevisions.id, input.revisionId),
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
      ),
    )
    .limit(1);
  if (!owner?.revision.gapAnalysisReleaseId) {
    throw new ApiError(
      404,
      "Generated Gap inputs were not found",
      undefined,
      "GAP_REVISION_NOT_FOUND",
    );
  }

  const sources = await db.query.artifactRevisionSources.findMany({
    where: eq(artifactRevisionSources.artifactRevisionId, input.revisionId),
  });
  const assessmentSources = sources.filter(
    (source) => source.sourceType === "assessment_revision",
  );
  if (assessmentSources.length !== 1) {
    throw new ApiError(
      409,
      "The generated Gap questionnaire snapshot is unavailable",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  const assessmentRevisionId = assessmentSources[0]!.sourceId;
  const [assessmentRow] = await db
    .select({
      revision: assessmentRevisions,
      assessment: assessments,
    })
    .from(assessmentRevisions)
    .innerJoin(
      assessments,
      eq(assessmentRevisions.assessmentId, assessments.id),
    )
    .where(
      and(
        eq(assessmentRevisions.id, assessmentRevisionId),
        eq(assessments.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  if (!assessmentRow) {
    throw new ApiError(
      409,
      "The generated Gap questionnaire snapshot is unavailable",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  const release = await loadGapAnalysisRelease(
    owner.revision.gapAnalysisReleaseId,
    input.locale,
  );
  if (!release) {
    throw new ApiError(
      409,
      "The generated Gap content release is unavailable",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }

  const answers = await db.query.assessmentAnswers.findMany({
    where: eq(
      assessmentAnswers.assessmentRevisionId,
      assessmentRevisionId,
    ),
  });
  const selectedOptions = answers.length
    ? await db
        .select({
          answerId: assessmentAnswerOptions.assessmentAnswerId,
          optionId: questionOptions.id,
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
            answers.map((answer) => answer.id),
          ),
        )
    : [];
  const answerByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  const questionSnapshots = release.questions.map((question) => {
    const answer = answerByQuestionId.get(question.id);
    const optionIds = answer
      ? selectedOptions
          .filter((selected) => selected.answerId === answer.id)
          .map((selected) => selected.optionId)
      : [];
    const optionLabels = optionIds.flatMap((optionId) => {
      const option = question.options.find(
        (candidate) => candidate.id === optionId,
      );
      return option ? [option.label] : [];
    });
    const value: FrozenAnswerValue = {
      optionLabels,
      textValue: answer?.textValue ?? null,
      numberValue: answer?.numberValue ?? null,
      booleanValue: answer?.booleanValue ?? null,
      dateValue: answer?.dateValue ?? null,
      structuredValue: answer?.structuredValue ?? null,
    };
    return {
      questionId: question.id,
      stableKey: question.stableKey,
      question: question.questionText,
      required: question.required,
      answerType: question.answerType,
      optionIds,
      optionLabels,
      displayAnswer: formatFrozenAnswer(value, input.locale),
    };
  });

  const documentVersionIds = sources
    .filter((source) => source.sourceType === "document_version")
    .map((source) => source.sourceId);
  const documentRows = documentVersionIds.length
    ? await db
        .select({ version: documentVersions, document: documents })
        .from(documentVersions)
        .innerJoin(
          documents,
          eq(documentVersions.documentId, documents.id),
        )
        .where(
          and(
            inArray(documentVersions.id, documentVersionIds),
            eq(documents.organizationId, input.organizationId),
          ),
        )
    : [];
  const documentByVersionId = new Map(
    documentRows.map((row) => [row.version.id, row]),
  );

  return {
    revisionId: owner.revision.id,
    assessmentRevision: {
      id: assessmentRow.revision.id,
      revisionNumber: assessmentRow.revision.revisionNumber,
      submittedAt: assessmentRow.revision.submittedAt,
    },
    questions: questionSnapshots,
    documents: documentVersionIds.map((versionId) => {
      const row = documentByVersionId.get(versionId);
      return row
        ? {
            documentVersionId: row.version.id,
            documentId: row.document.id,
            title: row.document.title,
            fileName: row.version.fileName,
            versionNumber: row.version.versionNumber,
            archived:
              row.document.status === "archived" ||
              Boolean(row.version.archivedAt),
            unavailable: false,
          }
        : {
            documentVersionId: versionId,
            documentId: null,
            title: null,
            fileName: null,
            versionNumber: null,
            archived: false,
            unavailable: true,
          };
    }),
  };
}
