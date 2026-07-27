import { db } from "@/src/db";
import {
  aiProcessingRunArtifactInputs,
  aiProcessingRunAssessmentInputs,
  aiProcessingRunDocumentInputs,
  aiProcessingRuns,
  artifactRevisionArtifactSources,
  artifactRevisionAssessmentSources,
  artifactRevisionDocumentSources,
  assessmentAnswerOptions,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  auditEvents,
  backgroundJobResults,
  backgroundJobs,
  documentVersions,
  documents,
  gapFindingEvidence,
  gapFindings,
  gapItemEvidence,
  gapItems,
  gapReassessmentDrafts,
  generatedArtifactRevisions,
  generatedArtifacts,
  questionOptions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, eq, inArray } from "drizzle-orm";
import { contentHash } from "@/src/server/compliance";
import { ApiError } from "../api/errors";
import { assertCanContributeToOrganization } from "../organizations/service";
import {
  deriveFindingSeverity,
  type SuppliedCitation,
} from "./generation-domain";
import { loadGapAnalysisRelease } from "./release-loader";
import { assertOutputLocaleMatches } from "../ai/grounding/language-policy";
import { assertGapInputsMutable } from "./lifecycle-guards";
import { buildGeneratedGapRevisionMetadata } from "./gap-revision-metadata";
import { resolveGapGenerationPrerequisites } from "./applicability-eligibility";
import { deriveAtomicGapTriggerPolicy } from "./trigger-policy";
import { generateAtomicGapBatch } from "./atomic-gap-generation";
import type { ValidatedCategoryGapResult } from "./generation-schema-v7";
import { defaultGapStatementMaximum } from "./generation-schema-v8";

export async function generateGapAnalysis(input: {
  userId: string;
  organizationId: string;
  assessmentId: string;
  assessmentRevisionId?: string;
  selectedDocumentVersionIds: string[];
  locale: Locale;
  retryNonce?: string;
  jobId?: string;
  asOfDate?: string;
  abortSignal?: AbortSignal;
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
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
          eq(table.id, input.assessmentId),
          eq(table.organizationId, input.organizationId),
          eq(table.status, "active"),
        ) ?? operators.sql`true`,
    },
  });
  if (
    !assessment?.gapAnalysisReleaseId ||
    !assessment.applicabilityArtifactRevisionId ||
    !(input.assessmentRevisionId ?? assessment.currentRevisionId)
  ) {
    throw new ApiError(
      409,
      "Submit the pinned gap questionnaire before generation",
    );
  }
  if (!input.jobId) {
    await assertGapInputsMutable({
      organizationId: input.organizationId,
      moduleId: assessment.moduleId,
    });
  }
  const assessmentRevisionId =
    input.assessmentRevisionId ?? assessment.currentRevisionId!;
  const assessmentRevision = await db.query.assessmentRevisions.findFirst({
    columns: {
      id: true,
      assessmentId: true,
      questionnaireVersionId: true,
      revisionNumber: true,
      parentRevisionId: true,
      status: true,
      createdBy: true,
      createdAt: true,
      submittedAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, assessmentRevisionId),
          eq(table.assessmentId, assessment.id),
        ) ?? operators.sql`true`,
    },
  });
  if (!assessmentRevision) {
    throw new ApiError(409, "Pinned gap questionnaire revision is unavailable");
  }
  const release = await loadGapAnalysisRelease(
    assessment.gapAnalysisReleaseId,
    input.locale,
  );
  if (!release) throw new ApiError(409, "Pinned gap release is unavailable");
  const applicability = await db.query.generatedArtifactRevisions.findFirst({
    columns: {
      id: true,
      artifactId: true,
      revisionNumber: true,
      parentRevisionId: true,
      status: true,
      result: true,
      outputLocale: true,
      modelName: true,
      promptVersion: true,
      ruleSetId: true,
      checkReleaseId: true,
      gapAnalysisReleaseId: true,
      evaluatorKind: true,
      outcomeCode: true,
      evaluatedAt: true,
      inputHash: true,
      generatedBy: true,
      createdBy: true,
      approvedBy: true,
      approvedAt: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.id, assessment.applicabilityArtifactRevisionId!) ??
        operators.sql`true`,
    },
  });
  const {
    artifact: applicabilityArtifact,
    requirements: applicableRequirements,
  } = resolveGapGenerationPrerequisites({
    compatibleCheckReleaseId: release.compatibleCheckReleaseId,
    artifact: applicability,
    requirements: release.requirements,
  });
  if (!["7", "8"].includes(release.prompt.responseSchemaVersion)) {
    throw new ApiError(
      409,
      "The pinned Gap release contract is unsupported",
      undefined,
      "GAP_RELEASE_CONTRACT_UNSUPPORTED",
    );
  }
  const evaluationRows =
    await db.query.assessmentRequirementEvaluations.findMany({
      columns: {
        assessmentRevisionId: true,
        requirementVersionId: true,
        status: true,
        evaluatorKind: true,
        evaluatorVersion: true,
        inputHash: true,
      },
      where: {
        RAW: (table, operators) =>
          eq(table.assessmentRevisionId, assessmentRevisionId) ??
          operators.sql`true`,
      },
    });
  if (
    evaluationRows.length !== applicableRequirements.length ||
    applicableRequirements.some(
      (requirement) =>
        !evaluationRows.some(
          (evaluation) =>
            evaluation.requirementVersionId === requirement.id &&
            evaluation.evaluatorKind === release.evaluator.kind &&
            evaluation.evaluatorVersion === release.evaluator.version,
        ),
    )
  ) {
    throw new ApiError(
      409,
      "Deterministic Gap evaluation coverage is incomplete",
      undefined,
      "GAP_EVALUATION_INCOMPLETE",
    );
  }
  const answerRows = await db.query.assessmentAnswers.findMany({
    columns: {
      id: true,
      assessmentRevisionId: true,
      questionId: true,
      questionStableKey: true,
      textValue: true,
      numberValue: true,
      booleanValue: true,
      dateValue: true,
      structuredValue: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.assessmentRevisionId, assessmentRevisionId) ??
        operators.sql`true`,
    },
  });
  const answerOptionRows = answerRows.length
    ? await db
        .select({
          answerId: assessmentAnswerOptions.assessmentAnswerId,
          option: questionOptions,
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
  const selectedVersionIds = [...new Set(input.selectedDocumentVersionIds)];
  const documentRows = selectedVersionIds.length
    ? await db
        .select({
          id: documentVersions.id,
          contentHash: documentVersions.contentHash,
          organizationId: documents.organizationId,
        })
        .from(documentVersions)
        .innerJoin(documents, eq(documentVersions.documentId, documents.id))
        .where(inArray(documentVersions.id, selectedVersionIds))
    : [];
  if (
    documentRows.length !== selectedVersionIds.length ||
    documentRows.some((row) => row.organizationId !== input.organizationId)
  ) {
    throw new ApiError(404, "A selected document version was not found");
  }
  const sourceInputHash = contentHash({
    gapAnalysisReleaseId: release.id,
    locale: input.locale,
    assessmentRevisionId,
    applicabilityArtifactRevisionId: applicabilityArtifact.id,
    applicabilityInputHash: applicabilityArtifact.inputHash,
    answers: answerRows.map((answer) => ({
      id: answer.id,
      questionStableKey: answer.questionStableKey,
      optionIds: answerOptionRows
        .filter((row) => row.answerId === answer.id)
        .map((row) => row.option.id)
        .sort(),
    })),
    documents: documentRows
      .map((row) => ({ id: row.id, contentHash: row.contentHash }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    evaluations: evaluationRows
      .map((evaluation) => ({
        requirementVersionId: evaluation.requirementVersionId,
        status: evaluation.status,
        inputHash: evaluation.inputHash,
      }))
      .sort((left, right) =>
        left.requirementVersionId.localeCompare(right.requirementVersionId),
      ),
  });
  const idempotencyKey = contentHash({
    sourceInputHash,
    retryNonce: input.retryNonce ?? "initial",
  });
  const existingRun = await db.query.aiProcessingRuns.findFirst({
    columns: {
      id: true,
      organizationId: true,
      assessmentRevisionId: true,
      operationKind: true,
      status: true,
      outputLocale: true,
      attemptCount: true,
      languageValidation: true,
      inputHash: true,
      idempotencyKey: true,
      provider: true,
      model: true,
      promptName: true,
      promptVersion: true,
      promptTemplateHash: true,
      renderedInputHash: true,
      responseSchemaVersion: true,
      inputTokens: true,
      outputTokens: true,
      cachedInputTokens: true,
      validatedOutput: true,
      jobId: true,
      providerPolicyVersion: true,
      corpusReleaseSetHash: true,
      provenanceStatus: true,
      cancellationRequestedAt: true,
      outputArtifactRevisionId: true,
      errorCode: true,
      errorMessage: true,
      createdBy: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, input.organizationId),
          eq(table.operationKind, "gap_analysis"),
          eq(table.idempotencyKey, idempotencyKey),
        ) ?? operators.sql`true`,
    },
  });
  if (existingRun) {
    assertOutputLocaleMatches(existingRun.outputLocale, input.locale, {
      runId: existingRun.id,
    });
    const artifactRevision = existingRun.outputArtifactRevisionId
      ? await db.query.generatedArtifactRevisions.findFirst({
          columns: {
            id: true,
            artifactId: true,
            revisionNumber: true,
            parentRevisionId: true,
            status: true,
            result: true,
            outputLocale: true,
            modelName: true,
            promptVersion: true,
            ruleSetId: true,
            checkReleaseId: true,
            gapAnalysisReleaseId: true,
            evaluatorKind: true,
            outcomeCode: true,
            evaluatedAt: true,
            inputHash: true,
            generatedBy: true,
            createdBy: true,
            approvedBy: true,
            approvedAt: true,
            createdAt: true,
          },
          where: {
            RAW: (table, operators) =>
              eq(table.id, existingRun.outputArtifactRevisionId!) ??
              operators.sql`true`,
          },
        })
      : undefined;
    if (existingRun.status === "succeeded" && artifactRevision) {
      return { run: existingRun, artifactRevision, reused: true };
    }
  }

  // The rollout is complete: every production Gap analysis enters through the
  // Grounding Gateway, regardless of a stale caller's former feature flag.
  return generateGroundedGapResult({
    input,
    release,
    assessmentRevisionId,
    applicability: applicabilityArtifact,
    applicableRequirements,
    answerRows,
    answerOptionRows,
    documentRows,
    selectedVersionIds,
    sourceInputHash,
    idempotencyKey,
    evaluationRows,
  });
}

async function generateGroundedGapResult(input: {
  input: Parameters<typeof generateGapAnalysis>[0];
  release: NonNullable<Awaited<ReturnType<typeof loadGapAnalysisRelease>>>;
  assessmentRevisionId: string;
  applicability: typeof generatedArtifactRevisions.$inferSelect;
  applicableRequirements: NonNullable<
    Awaited<ReturnType<typeof loadGapAnalysisRelease>>
  >["requirements"];
  answerRows: Array<typeof assessmentAnswers.$inferSelect>;
  answerOptionRows: Array<{
    answerId: string;
    option: typeof questionOptions.$inferSelect;
  }>;
  documentRows: Array<{
    id: string;
    contentHash: string;
    organizationId: string;
  }>;
  selectedVersionIds: string[];
  sourceInputHash: string;
  idempotencyKey: string;
  evaluationRows: Array<{
    assessmentRevisionId: string;
    requirementVersionId: string;
    status:
      | "fulfilled"
      | "partially_fulfilled"
      | "not_fulfilled"
      | "insufficient_evidence";
    evaluatorKind: string;
    evaluatorVersion: number;
    inputHash: string;
  }>;
}) {
  if (!["7", "8"].includes(input.release.prompt.responseSchemaVersion)) {
    throw new ApiError(
      409,
      "The pinned Gap release contract is unsupported",
      undefined,
      "GAP_RELEASE_CONTRACT_UNSUPPORTED",
    );
  }
  const evaluationByRequirementId = new Map(
    input.evaluationRows.map((evaluation) => [
      evaluation.requirementVersionId,
      evaluation,
    ]),
  );
  return generateGroundedAtomicGapsV7(input, evaluationByRequirementId);
}

type PersistableGapFinding = ValidatedCategoryGapResult & {
  status:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence";
  generationRunId: string;
  questionnaireDisagreements: string[];
};

type PersistedGapRequirement = {
  code: string;
  title: string;
  requirementText: string;
  criticality: string;
  legalReferences: unknown;
  citations: SuppliedCitation[];
  determinedStatus?:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence";
};

async function generateGroundedAtomicGapsV7(
  input: Parameters<typeof generateGroundedGapResult>[0],
  evaluationByRequirementId: Map<
    string,
    Parameters<typeof generateGroundedGapResult>[0]["evaluationRows"][number]
  >,
) {
  const requirementPolicies = input.applicableRequirements.map(
    (requirement) => {
      const questions = requirement.questionStableKeys.map((stableKey) => {
        const question = input.release.questions.find(
          (candidate) => candidate.stableKey === stableKey,
        );
        const answer = input.answerRows.find(
          (candidate) => candidate.questionStableKey === stableKey,
        );
        const selectedOptions = answer
          ? input.answerOptionRows.filter((row) => row.answerId === answer.id)
          : [];
        const stableValue = selectedOptions[0]?.option.stableValue;
        if (
          !question ||
          !answer ||
          selectedOptions.length !== 1 ||
          !isGapAnswerValue(stableValue)
        ) {
          throw new ApiError(
            409,
            "Pinned questionnaire answers are incomplete",
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
      });
      return {
        requirement,
        determinedStatus: requireValue(
          evaluationByRequirementId,
          requirement.id,
        ).status,
        policy: deriveAtomicGapTriggerPolicy({
          determinedStatus: requireValue(
            evaluationByRequirementId,
            requirement.id,
          ).status,
          questions,
        }),
        sourceAssessmentAnswerIdByQuestion: Object.fromEntries(
          questions.map((question) => {
            const answer = input.answerRows.find(
              (candidate) => candidate.questionStableKey === question.stableKey,
            );
            if (!answer) {
              throw new ApiError(
                409,
                "Pinned questionnaire answers are incomplete",
                undefined,
                "GAP_INPUT_SNAPSHOT_INVALID",
              );
            }
            return [question.stableKey, answer.id];
          }),
        ),
        statementMaximumByQuestion: Object.fromEntries(
          questions.map((question) => {
            const definition = input.release.questions.find(
              (candidate) => candidate.stableKey === question.stableKey,
            );
            return [
              question.stableKey,
              defaultGapStatementMaximum({
                splittable: definition?.splittable,
                maximumStatements: definition?.maximumStatements,
              }),
            ];
          }),
        ),
      };
    },
  );
  const questionnaireAssertions = input.applicableRequirements.flatMap(
    (requirement) =>
      questionnaireCitations(
        requirement.questionStableKeys,
        input.answerRows,
        input.answerOptionRows,
        input.release.questions,
      ).map((citation) => ({
        answerId: citation.sourceId,
        queryUnitId: requirement.code,
        excerpt: citation.excerpt,
      })),
  );
  const generated = await generateAtomicGapBatch({
    actor: { userId: input.input.userId },
    organizationId: input.input.organizationId,
    assessmentRevisionId: input.assessmentRevisionId,
    release: input.release,
    requirements: requirementPolicies,
    selectedDocumentVersionIds: input.selectedVersionIds,
    outputLocale: input.input.locale,
    idempotencyKey: input.idempotencyKey,
    questionnaireAssertions,
    asOfDate: input.input.asOfDate,
    jobId: input.input.jobId,
    abortSignal: input.input.abortSignal,
  });
  const citations: SuppliedCitation[] = generated.context.map((item) => ({
    id: item.citationId,
    sourceType:
      item.channel === "legal"
        ? "legal_source_chunk"
        : item.channel === "organization_document"
          ? "document_chunk"
          : "assessment_answer",
    sourceId: item.sourceId,
    excerpt: item.excerpt,
    pageNumber:
      typeof item.metadata.pageNumber === "number"
        ? item.metadata.pageNumber
        : null,
    sectionLabel:
      typeof item.metadata.sectionPath === "string"
        ? item.metadata.sectionPath
        : null,
  }));
  const requirementByCode = new Map(
    input.applicableRequirements.map((requirement) => [
      requirement.code,
      requirement,
    ]),
  );
  const findings: PersistableGapFinding[] = generated.findings.map(
    (finding) => {
      const requirement = requireValue(
        requirementByCode,
        finding.requirementCode,
      );
      return {
        ...finding,
        status: requireValue(evaluationByRequirementId, requirement.id).status,
        generationRunId:
          generated.runIdsByCategory?.[finding.requirementCode] ??
          generated.runId,
        questionnaireDisagreements: [],
      };
    },
  );
  const generatedRunIds = [
    ...new Set(
      generated.runIdsByCategory
        ? Object.values(generated.runIdsByCategory)
        : [generated.runId],
    ),
  ];
  await Promise.all([
    db
      .insert(aiProcessingRunAssessmentInputs)
      .values(generatedRunIds.map((runId) => ({
        runId,
        assessmentRevisionId: input.assessmentRevisionId,
        sourceHash: contentHash(input.answerRows),
      })))
      .onConflictDoNothing(),
    db
      .insert(aiProcessingRunArtifactInputs)
      .values(generatedRunIds.map((runId) => ({
        runId,
        artifactRevisionId: input.applicability.id,
        sourceHash:
          input.applicability.inputHash ??
          contentHash(input.applicability.result),
      })))
      .onConflictDoNothing(),
    input.documentRows.length
      ? db
          .insert(aiProcessingRunDocumentInputs)
          .values(
            generatedRunIds.flatMap((runId) =>
              input.documentRows.map((document) => ({
                runId,
                documentVersionId: document.id,
                sourceHash: document.contentHash,
              })),
            ),
          )
          .onConflictDoNothing()
      : Promise.resolve(),
  ]);
  const runs = await db.query.aiProcessingRuns.findMany({
    columns: {
      id: true,
      model: true,
      renderedInputHash: true,
      inputTokens: true,
      outputTokens: true,
    },
    where: {
      RAW: (table, operators) =>
        operators.inArray(table.id, generatedRunIds),
    },
  });
  const run = runs.find((candidate) => candidate.id === generated.runId);
  if (!run) throw new Error("Grounded AI run was not persisted");
  const promptRequirements = input.applicableRequirements.map(
    (requirement) => ({
      code: requirement.code,
      title: requirement.title,
      requirementText: requirement.requirementText,
      criticality: requirement.criticality,
      legalReferences: requirement.legalReferences,
      citations: citations.filter((citation) =>
        generated.context.some(
          (item) =>
            item.queryUnitId === requirement.code &&
            item.citationId === citation.id,
        ),
      ),
      determinedStatus: requireValue(evaluationByRequirementId, requirement.id)
        .status,
    }),
  );
  const persisted = await persistGeneratedGapResult({
    runId: generated.runId,
    runIds: generatedRunIds,
    userId: input.input.userId,
    organizationId: input.input.organizationId,
    assessmentRevisionId: input.assessmentRevisionId,
    applicabilityArtifactRevisionId: input.applicability.id,
    release: input.release,
    selectedVersionIds: input.selectedVersionIds,
    promptRequirements,
    findings,
    outputLocale: input.input.locale,
    model: { model: run.model ?? "grounded-provider" },
    sourceInputHash: input.sourceInputHash,
    renderedInputHash: contentHash(
      runs.map((candidate) => candidate.renderedInputHash),
    ),
    inputTokens: runs.reduce(
      (total, candidate) => total + (candidate.inputTokens ?? 0),
      0,
    ),
    outputTokens: runs.reduce(
      (total, candidate) => total + (candidate.outputTokens ?? 0),
      0,
    ),
    jobId: input.input.jobId,
    deterministicStatuses: new Map(
      input.evaluationRows.map((evaluation) => [
        evaluation.requirementVersionId,
        evaluation.status,
      ]),
    ),
  });
  return {
    run: persisted.run,
    artifactRevision: persisted.revision,
    reused: false,
  };
}

async function persistGeneratedGapResult(input: {
  runId: string;
  runIds?: string[];
  userId: string;
  organizationId: string;
  assessmentRevisionId: string;
  applicabilityArtifactRevisionId: string;
  release: NonNullable<Awaited<ReturnType<typeof loadGapAnalysisRelease>>>;
  selectedVersionIds: string[];
  promptRequirements: PersistedGapRequirement[];
  findings: PersistableGapFinding[];
  outputLocale: Locale;
  model: { model: string };
  sourceInputHash: string;
  renderedInputHash: string;
  inputTokens: number;
  outputTokens: number;
  jobId?: string;
  deterministicStatuses: Map<
    string,
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence"
  > | null;
}) {
  const citationById = new Map(
    input.promptRequirements
      .flatMap((requirement) => requirement.citations)
      .map((citation) => [citation.id, citation]),
  );
  const requirementByCode = new Map(
    input.release.requirements.map((requirement) => [
      requirement.code,
      requirement,
    ]),
  );
  return db.transaction(async (tx) => {
    if (input.jobId) {
      const [job] = await tx
        .select({ state: backgroundJobs.state })
        .from(backgroundJobs)
        .where(eq(backgroundJobs.id, input.jobId))
        .limit(1)
        .for("update");
      if (
        !job ||
        job.state === "cancellation_requested" ||
        job.state === "cancelled"
      ) {
        const cancellation = new Error(
          "Gap generation was cancelled before persistence",
        );
        cancellation.name = "JobCancellationError";
        throw cancellation;
      }
      if (job.state !== "running")
        throw new Error("Gap generation job no longer owns persistence");
    }
    const [lockedAssessment] = await tx
      .select({ id: assessments.id })
      .from(assessments)
      .innerJoin(
        assessmentRevisions,
        eq(assessmentRevisions.assessmentId, assessments.id),
      )
      .where(eq(assessmentRevisions.id, input.assessmentRevisionId))
      .limit(1)
      .for("update");
    if (!lockedAssessment) {
      throw new ApiError(
        409,
        "The generated Gap questionnaire snapshot is unavailable",
        undefined,
        "GAP_INPUT_SNAPSHOT_INVALID",
      );
    }
    const pinnedAnswers = await tx.query.assessmentAnswers.findMany({
      columns: { id: true, questionStableKey: true },
      where: {
        RAW: (table, operators) =>
          eq(table.assessmentRevisionId, input.assessmentRevisionId) ??
          operators.sql`true`,
      },
    });
    const pinnedQuestionByAnswerId = new Map(
      pinnedAnswers.map((answer) => [answer.id, answer.questionStableKey]),
    );
    if (input.deterministicStatuses) {
      const evaluations =
        await tx.query.assessmentRequirementEvaluations.findMany({
          columns: {
            requirementVersionId: true,
            status: true,
            evaluatorKind: true,
            evaluatorVersion: true,
          },
          where: {
            RAW: (table, operators) =>
              eq(table.assessmentRevisionId, input.assessmentRevisionId) ??
              operators.sql`true`,
          },
        });
      if (
        evaluations.length !== input.findings.length ||
        input.findings.some((finding) => {
          const requirement = requireValue(
            requirementByCode,
            finding.requirementCode,
          );
          const evaluation = evaluations.find(
            (candidate) => candidate.requirementVersionId === requirement.id,
          );
          return (
            !evaluation ||
            evaluation.status !== finding.status ||
            evaluation.status !==
              input.deterministicStatuses!.get(requirement.id) ||
            evaluation.evaluatorKind !== input.release.evaluator.kind ||
            evaluation.evaluatorVersion !== input.release.evaluator.version
          );
        })
      ) {
        throw new ApiError(
          409,
          "Deterministic Gap evaluation changed before persistence",
          undefined,
          "GAP_EVALUATION_INCOMPLETE",
        );
      }
    }
    let artifact = await tx.query.generatedArtifacts.findFirst({
      columns: {
        id: true,
        organizationId: true,
        moduleId: true,
        artifactType: true,
        currentRevisionId: true,
        acceptedRevisionId: true,
        createdAt: true,
      },
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.organizationId, input.organizationId),
            eq(table.moduleId, input.release.moduleId),
            eq(table.artifactType, "gap_analysis_result"),
          ) ?? operators.sql`true`,
      },
    });
    if (artifact?.currentRevisionId) {
      throw new ApiError(
        409,
        "A Gap Analysis has already been generated",
        undefined,
        "GAP_ALREADY_GENERATED",
      );
    }
    if (!artifact) {
      [artifact] = await tx
        .insert(generatedArtifacts)
        .values({
          organizationId: input.organizationId,
          moduleId: input.release.moduleId,
          artifactType: "gap_analysis_result",
        })
        .returning();
    }
    if (!artifact) throw new Error("Could not create gap artifact");
    const latest = await tx.query.generatedArtifactRevisions.findFirst({
      columns: {
        id: true,
        artifactId: true,
        revisionNumber: true,
        parentRevisionId: true,
        status: true,
        result: true,
        outputLocale: true,
        modelName: true,
        promptVersion: true,
        ruleSetId: true,
        checkReleaseId: true,
        gapAnalysisReleaseId: true,
        evaluatorKind: true,
        outcomeCode: true,
        evaluatedAt: true,
        inputHash: true,
        generatedBy: true,
        createdBy: true,
        approvedBy: true,
        approvedAt: true,
        createdAt: true,
      },
      where: {
        RAW: (table, operators) =>
          eq(table.artifactId, artifact.id) ?? operators.sql`true`,
      },
      orderBy: { revisionNumber: "desc" },
    });
    const summary = buildGeneratedGapRevisionMetadata({
      outputLocale: input.outputLocale,
      expectedRequirementVersionIds: input.findings.map(
        (finding) =>
          requireValue(requirementByCode, finding.requirementCode).id,
      ),
      findingDiagnostics: input.findings.map((finding) => {
        const requirement = requireValue(
          requirementByCode,
          finding.requirementCode,
        );
        return {
          requirementVersionId: requirement.id,
          contradictions: finding.contradictions,
          questionnaireDisagreements: finding.questionnaireDisagreements,
        };
      }),
    });
    const [revision] = await tx
      .insert(generatedArtifactRevisions)
      .values({
        artifactId: artifact.id,
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        parentRevisionId: artifact.currentRevisionId,
        status: "generated",
        result: summary,
        outputLocale: input.outputLocale,
        modelName: input.model.model,
        promptVersion: input.release.prompt.version,
        gapAnalysisReleaseId: input.release.id,
        evaluatorKind: input.release.evaluator.kind,
        evaluatedAt: new Date(),
        inputHash: input.sourceInputHash,
        generatedBy: "ai",
        createdBy: input.userId,
      })
      .returning();
    if (!revision) throw new Error("Could not create gap artifact revision");
    await tx.insert(artifactRevisionAssessmentSources).values({
      artifactRevisionId: revision.id,
      assessmentRevisionId: input.assessmentRevisionId,
    });
    await tx.insert(artifactRevisionArtifactSources).values({
      artifactRevisionId: revision.id,
      sourceArtifactRevisionId: input.applicabilityArtifactRevisionId,
    });
    if (input.selectedVersionIds.length) {
      await tx.insert(artifactRevisionDocumentSources).values(
        input.selectedVersionIds.map((documentVersionId) => ({
          artifactRevisionId: revision.id,
          documentVersionId,
        })),
      );
    }
    for (const finding of input.findings) {
      const requirement = requireValue(
        requirementByCode,
        finding.requirementCode,
      );
      assertPersistableAtomicFinding(
        finding,
        requirement,
        new Set(input.runIds ?? [input.runId]),
      );
      if (
        finding.gaps.some(
          (gap) =>
            pinnedQuestionByAnswerId.get(gap.sourceAssessmentAnswerId) !==
            gap.questionStableKey,
        )
      ) {
        throw new ApiError(
          422,
          "An atomic Gap is not traceable to the pinned assessment answer",
          undefined,
          "GAP_ANSWER_TRACE_INVALID",
        );
      }
      const [storedFinding] = await tx
        .insert(gapFindings)
        .values({
          artifactRevisionId: revision.id,
          requirementVersionId: requirement.id,
          status: finding.status,
          evidenceSufficiency: finding.evidenceSufficiency,
          severity: deriveFindingSeverity(
            requirement.criticality,
            finding.status,
          ),
          statementBasis: finding.statementBasis,
          statementBasisHash: finding.statementBasisHash,
          reviewNotice: finding.reviewNotice,
          generationRunId: finding.generationRunId,
          assumptions: finding.assumptions,
          requiresReview: finding.requiresReview,
        })
        .returning();
      if (!storedFinding) throw new Error("Could not persist gap finding");
      const findingCitationIds = [
        ...new Set([
          ...finding.citationIds,
          ...finding.gaps.flatMap((gap) => gap.citationIds),
        ]),
      ];
      const storedEvidence = findingCitationIds.length
        ? await tx
            .insert(gapFindingEvidence)
            .values(
              findingCitationIds.map((citationId) => {
                const citation = requireValue(citationById, citationId);
                return {
                  findingId: storedFinding.id,
                  citationId,
                  sourceType: citation.sourceType,
                  assessmentAnswerId:
                    citation.sourceType === "assessment_answer"
                      ? citation.sourceId
                      : null,
                  documentChunkId:
                    citation.sourceType === "document_chunk"
                      ? citation.sourceId
                      : null,
                  legalSourceChunkId:
                    citation.sourceType === "legal_source_chunk"
                      ? citation.sourceId
                      : null,
                  excerpt: citation.excerpt,
                  pageNumber: citation.pageNumber,
                  sectionLabel: citation.sectionLabel,
                };
              }),
            )
            .returning({
              id: gapFindingEvidence.id,
              citationId: gapFindingEvidence.citationId,
            })
        : [];
      if (finding.gaps.length > 0) {
        const storedGaps = await tx
          .insert(gapItems)
          .values(
            finding.gaps.map((gap, index) => ({
              findingId: storedFinding.id,
              sourceAssessmentAnswerId: gap.sourceAssessmentAnswerId,
              questionStableKey: gap.questionStableKey,
              kind: gap.kind,
              statement: gap.statement,
              position: index + 1,
            })),
          )
          .returning({ id: gapItems.id, position: gapItems.position });
        const evidenceIdByCitation = new Map(
          storedEvidence.map((item) => [item.citationId, item.id]),
        );
        await tx.insert(gapItemEvidence).values(
          finding.gaps.flatMap((gap, index) => {
            const storedGap = storedGaps.find(
              (item) => item.position === index + 1,
            );
            if (!storedGap) {
              throw new Error("Stored atomic Gap position is missing");
            }
            return gap.citationIds.map((citationId) => ({
              gapItemId: storedGap.id,
              gapFindingEvidenceId: requireValue(
                evidenceIdByCitation,
                citationId,
              ),
            }));
          }),
        );
      }
    }
    await tx
      .update(generatedArtifacts)
      .set({ currentRevisionId: revision.id })
      .where(eq(generatedArtifacts.id, artifact.id));
    const completedRuns = await tx
      .update(aiProcessingRuns)
      .set({
        status: "succeeded",
        outputArtifactRevisionId: revision.id,
        renderedInputHash: input.renderedInputHash,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        completedAt: new Date(),
      })
      .where(inArray(aiProcessingRuns.id, input.runIds ?? [input.runId]))
      .returning();
    const completedRun = completedRuns.find((run) => run.id === input.runId);
    if (!completedRun) throw new Error("Primary Gap generation run is missing");
    const events: Array<typeof auditEvents.$inferInsert> = [
      {
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "ai_run.succeeded",
        entityType: "ai_processing_run",
        entityId: input.runId,
        metadata: { artifactRevisionId: revision.id },
      },
      {
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "gap_revision.created",
        entityType: "generated_artifact_revision",
        entityId: revision.id,
        metadata: { generatedBy: "ai" },
      },
    ];
    if (input.jobId) {
      const [draft] = await tx
        .update(gapReassessmentDrafts)
        .set({
          status: "generated",
          aiProcessingRunId: input.runId,
          outputGapRevisionId: revision.id,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(gapReassessmentDrafts.generationJobId, input.jobId),
            eq(gapReassessmentDrafts.status, "locked"),
          ),
        )
        .returning({ id: gapReassessmentDrafts.id });
      if (!draft)
        throw new Error("Gap reassessment draft no longer owns persistence");
      events.push({
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "gap_reassessment.generated",
        entityType: "gap_reassessment_draft",
        entityId: draft.id,
        metadata: {
          aiProcessingRunId: input.runId,
          outputGapRevisionId: revision.id,
        },
      });
      const [completedJob] = await tx
        .update(backgroundJobs)
        .set({
          state: "succeeded",
          progress: 100,
          safeErrorCode: null,
          safeErrorMessage: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(backgroundJobs.id, input.jobId),
            eq(backgroundJobs.state, "running"),
          ),
        )
        .returning({ id: backgroundJobs.id });
      if (!completedJob)
        throw new Error("Gap generation job no longer owns persistence");
      await tx.insert(backgroundJobResults).values({
        jobId: completedJob.id,
        generatedArtifactRevisionId: revision.id,
      });
    }
    await tx.insert(auditEvents).values(events);
    return { run: completedRun, revision };
  });
}

function questionnaireCitations(
  questionStableKeys: string[],
  answers: Array<typeof assessmentAnswers.$inferSelect>,
  answerOptions: Array<{
    answerId: string;
    option: typeof questionOptions.$inferSelect;
  }>,
  releaseQuestions: NonNullable<
    Awaited<ReturnType<typeof loadGapAnalysisRelease>>
  >["questions"],
): SuppliedCitation[] {
  return answers
    .filter((answer) => questionStableKeys.includes(answer.questionStableKey))
    .map((answer) => {
      const question = releaseQuestions.find(
        (candidate) => candidate.id === answer.questionId,
      );
      const selected = answerOptions
        .filter((row) => row.answerId === answer.id)
        .map(
          (row) =>
            question?.options.find((option) => option.id === row.option.id)
              ?.label ?? row.option.stableValue,
        );
      return {
        id: `Q:${answer.id}`,
        sourceType: "assessment_answer" as const,
        sourceId: answer.id,
        excerpt: `${question?.questionText ?? answer.questionStableKey}: ${selected.join(", ")}`,
        pageNumber: null,
        sectionLabel: null,
      };
    });
}

function requireValue<K, V>(values: Map<K, V>, key: K) {
  const value = values.get(key);
  if (!value) throw new Error(`Required value ${String(key)} is missing`);
  return value;
}

function assertPersistableAtomicFinding(
  finding: PersistableGapFinding,
  requirement: {
    questionStableKeys: string[];
  },
  expectedRunIds: Set<string>,
) {
  if (
    !expectedRunIds.has(finding.generationRunId) ||
    finding.statementBasisHash !== contentHash(finding.statementBasis)
  ) {
    throw new ApiError(
      409,
      "The Gap release does not provide valid atomic gaps",
      undefined,
      "GAP_ATOMIC_CONTRACT_UNSUPPORTED",
    );
  }
  const triggers = finding.statementBasis.triggeringQuestions;
  const fulfilled = finding.status === "fulfilled";
  if (
    (fulfilled && (triggers.length > 0 || finding.gaps.length > 0)) ||
    (!fulfilled && triggers.length === 0)
  ) {
    throw new ApiError(
      422,
      "Atomic Gap trigger coverage conflicts with category status",
      undefined,
      "GAP_TRIGGER_COVERAGE_INVALID",
    );
  }
  for (const trigger of triggers) {
    if (!requirement.questionStableKeys.includes(trigger.stableKey)) {
      throw new ApiError(
        422,
        "Atomic Gap trigger does not belong to its category",
        undefined,
        "GAP_TRIGGER_CATEGORY_INVALID",
      );
    }
    const gaps = finding.gaps.filter(
      (gap) => gap.questionStableKey === trigger.stableKey,
    );
    if (
      gaps.length < 1 ||
      gaps.length > 5 ||
      gaps.some(
        (gap) =>
          gap.kind !== trigger.kind ||
          gap.sourceAssessmentAnswerId !== trigger.sourceAssessmentAnswerId,
      )
    ) {
      throw new ApiError(
        422,
        "Atomic Gap trigger coverage is invalid",
        undefined,
        "GAP_TRIGGER_COVERAGE_INVALID",
      );
    }
  }
}

function isGapAnswerValue(
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
