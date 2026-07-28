import { db } from "@/src/db";
import {
  artifactRevisionArtifactSources,
  artifactRevisionAssessmentSources,
  artifactRevisionDocumentSources,
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
import {
  loadGapAnalysisRelease,
  type LoadedGapRelease,
} from "./release-loader";

type FrozenAnswerValue = {
  optionLabels: string[];
  textValue: string | null;
  numberValue: string | null;
  booleanValue: boolean | null;
  dateValue: string | null;
  structuredValue: unknown;
};

type GeneratedRevisionSnapshot = {
  id: string;
  gapAnalysisReleaseId: string | null;
};

type GeneratedSourceSnapshot = {
  sourceType: string;
  sourceId: string;
};

type GeneratedAssessmentRevisionSnapshot = {
  id: string;
  revisionNumber: number;
  submittedAt: Date | null;
};

type GeneratedAnswerSnapshot = {
  questionId: string;
  optionId: string | null;
  textValue: string | null;
  numberValue: string | null;
  booleanValue: boolean | null;
  dateValue: string | null;
  structuredValue: unknown;
};

type GeneratedDocumentSnapshot = {
  documentId: string;
  title: string;
  status: string;
  versionId: string;
  fileName: string;
  versionNumber: number;
  archivedAt: Date | null;
};

type GeneratedGapInputsDependencies = {
  loadOwner(input: {
    organizationId: string;
    revisionId: string;
  }): Promise<GeneratedRevisionSnapshot | null>;
  loadSources(revisionId: string): Promise<GeneratedSourceSnapshot[]>;
  loadAssessment(input: {
    organizationId: string;
    assessmentRevisionId: string;
  }): Promise<GeneratedAssessmentRevisionSnapshot | null>;
  loadRelease(
    releaseId: string,
    locale: Locale,
  ): Promise<LoadedGapRelease | null>;
  loadAnswers(
    assessmentRevisionId: string,
  ): Promise<GeneratedAnswerSnapshot[]>;
  loadDocuments(input: {
    organizationId: string;
    documentVersionIds: string[];
  }): Promise<GeneratedDocumentSnapshot[]>;
};

type GeneratedGapInputsInput = {
  organizationId: string;
  revisionId: string;
  locale: Locale;
};

type PreauthorizedGeneratedGapInputsInput = {
  organizationId: string;
  locale: Locale;
  revision: GeneratedRevisionSnapshot;
  release: LoadedGapRelease;
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

export function createGeneratedGapInputsReader(
  dependencies: GeneratedGapInputsDependencies,
) {
  async function buildSnapshot(input: {
    organizationId: string;
    locale: Locale;
    revision: GeneratedRevisionSnapshot;
    release?: LoadedGapRelease;
  }) {
    const releaseId = input.revision.gapAnalysisReleaseId;
    if (!releaseId) throw revisionNotFound();

    const sources = await dependencies.loadSources(input.revision.id);
    const assessmentSources = sources.filter(
      (source) => source.sourceType === "assessment_revision",
    );
    if (assessmentSources.length !== 1) throw invalidSnapshot();

    const assessmentRevisionId = assessmentSources[0]!.sourceId;
    const documentVersionIds = sources
      .filter((source) => source.sourceType === "document_version")
      .map((source) => source.sourceId);
    const [assessmentRevision, release, answerRows, documentRows] =
      await Promise.all([
        dependencies.loadAssessment({
          organizationId: input.organizationId,
          assessmentRevisionId,
        }),
        input.release?.id === releaseId
          ? Promise.resolve(input.release)
          : dependencies.loadRelease(releaseId, input.locale),
        dependencies.loadAnswers(assessmentRevisionId),
        dependencies.loadDocuments({
          organizationId: input.organizationId,
          documentVersionIds,
        }),
      ]);
    if (!assessmentRevision || !release) throw invalidSnapshot();

    const answerByQuestionId = new Map(
      answerRows.map((answer) => [answer.questionId, answer]),
    );
    const questionSnapshots = release.questions.map((question) => {
      const answer = answerByQuestionId.get(question.id);
      const optionIds = answerRows.flatMap((row) =>
        row.questionId === question.id && row.optionId ? [row.optionId] : [],
      );
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
    const documentByVersionId = new Map(
      documentRows.map((row) => [row.versionId, row]),
    );

    return {
      revisionId: input.revision.id,
      assessmentRevision,
      questions: questionSnapshots,
      documents: documentVersionIds.map((versionId) => {
        const row = documentByVersionId.get(versionId);
        return row
          ? {
              documentId: row.documentId,
              title: row.title,
              archived: row.status === "archived" || Boolean(row.archivedAt),
              unavailable: false,
            }
          : {
              documentId: null,
              title: null,
              archived: false,
              unavailable: true,
            };
      }),
    };
  }

  return {
    async get(input: GeneratedGapInputsInput) {
      const revision = await dependencies.loadOwner(input);
      if (!revision?.gapAnalysisReleaseId) throw revisionNotFound();
      return buildSnapshot({
        organizationId: input.organizationId,
        locale: input.locale,
        revision,
      });
    },
    getPreauthorized(input: PreauthorizedGeneratedGapInputsInput) {
      return buildSnapshot(input);
    },
  };
}

const generatedGapInputsReader = createGeneratedGapInputsReader({
  async loadOwner(input) {
    const [owner] = await db
      .select({
        id: generatedArtifactRevisions.id,
        gapAnalysisReleaseId:
          generatedArtifactRevisions.gapAnalysisReleaseId,
      })
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
    return owner ?? null;
  },
  async loadSources(revisionId) {
    const [assessmentSources, artifactSources, documentSources] = await Promise.all([
      db.select({ sourceId: artifactRevisionAssessmentSources.assessmentRevisionId })
        .from(artifactRevisionAssessmentSources)
        .where(eq(artifactRevisionAssessmentSources.artifactRevisionId, revisionId)),
      db.select({ sourceId: artifactRevisionArtifactSources.sourceArtifactRevisionId })
        .from(artifactRevisionArtifactSources)
        .where(eq(artifactRevisionArtifactSources.artifactRevisionId, revisionId)),
      db.select({ sourceId: artifactRevisionDocumentSources.documentVersionId })
        .from(artifactRevisionDocumentSources)
        .where(eq(artifactRevisionDocumentSources.artifactRevisionId, revisionId)),
    ]);
    return [
      ...assessmentSources.map(({ sourceId }) => ({ sourceType: "assessment_revision", sourceId })),
      ...artifactSources.map(({ sourceId }) => ({ sourceType: "artifact_revision", sourceId })),
      ...documentSources.map(({ sourceId }) => ({ sourceType: "document_version", sourceId })),
    ];
  },
  async loadAssessment(input) {
    const [row] = await db
      .select({
        id: assessmentRevisions.id,
        revisionNumber: assessmentRevisions.revisionNumber,
        submittedAt: assessmentRevisions.submittedAt,
      })
      .from(assessmentRevisions)
      .innerJoin(
        assessments,
        eq(assessmentRevisions.assessmentId, assessments.id),
      )
      .where(
        and(
          eq(assessmentRevisions.id, input.assessmentRevisionId),
          eq(assessments.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    return row ?? null;
  },
  loadRelease: loadGapAnalysisRelease,
  async loadAnswers(assessmentRevisionId) {
    return db
      .select({
        questionId: assessmentAnswers.questionId,
        optionId: questionOptions.id,
        textValue: assessmentAnswers.textValue,
        numberValue: assessmentAnswers.numberValue,
        booleanValue: assessmentAnswers.booleanValue,
        dateValue: assessmentAnswers.dateValue,
        structuredValue: assessmentAnswers.structuredValue,
      })
      .from(assessmentAnswers)
      .leftJoin(
        assessmentAnswerOptions,
        eq(
          assessmentAnswerOptions.assessmentAnswerId,
          assessmentAnswers.id,
        ),
      )
      .leftJoin(
        questionOptions,
        eq(assessmentAnswerOptions.questionOptionId, questionOptions.id),
      )
      .where(
        eq(
          assessmentAnswers.assessmentRevisionId,
          assessmentRevisionId,
        ),
      );
  },
  async loadDocuments(input) {
    if (!input.documentVersionIds.length) return [];
    return db
      .select({
        documentId: documents.id,
        title: documents.title,
        status: documents.status,
        versionId: documentVersions.id,
        fileName: documentVersions.fileName,
        versionNumber: documentVersions.versionNumber,
        archivedAt: documentVersions.archivedAt,
      })
      .from(documentVersions)
      .innerJoin(
        documents,
        eq(documentVersions.documentId, documents.id),
      )
      .where(
        and(
          inArray(documentVersions.id, input.documentVersionIds),
          eq(documents.organizationId, input.organizationId),
        ),
      );
  },
});

export function readGeneratedGapInputs(input: GeneratedGapInputsInput) {
  return generatedGapInputsReader.get(input);
}

export function readGeneratedGapInputsPreauthorized(
  input: PreauthorizedGeneratedGapInputsInput,
) {
  return generatedGapInputsReader.getPreauthorized(input);
}

function revisionNotFound() {
  return new ApiError(
    404,
    "Generated Gap inputs were not found",
    undefined,
    "GAP_REVISION_NOT_FOUND",
  );
}

function invalidSnapshot() {
  return new ApiError(
    409,
    "The generated Gap input snapshot is unavailable",
    undefined,
    "GAP_INPUT_SNAPSHOT_INVALID",
  );
}
