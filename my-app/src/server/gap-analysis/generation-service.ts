import { db } from "@/src/db";
import {
  aiProcessingRunInputs,
  aiProcessingRuns,
  artifactRevisionSources,
  assessmentAnswerOptions,
  assessmentAnswers,
  assessments,
  auditEvents,
  documentVersions,
  documents,
  gapFindingEvidence,
  gapFindings,
  generatedArtifactRevisions,
  generatedArtifacts,
  questionOptions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contentHash } from "../compliance/publishing/canonical-json";
import { ApiError } from "../api/errors";
import { assertCanContributeToOrganization } from "../organizations/service";
import { retrieveDocumentEvidence } from "../documents/retrieval";
import type { DocumentEmbeddingProvider } from "../documents/embeddings";
import {
  deriveFindingSeverity,
  type GapModelFinding,
  type SuppliedCitation,
  validateGapModelResponse,
} from "./generation-schema";
import { createGapGenerationModel, type GapGenerationModel } from "./model";
import { buildGapPrompt, type GapPromptRequirement } from "./prompt-builder";
import { loadGapAnalysisRelease } from "./release-loader";

export async function generateGapAnalysis(input: {
  userId: string;
  organizationId: string;
  assessmentId: string;
  selectedDocumentVersionIds: string[];
  locale: Locale;
  retryNonce?: string;
}, dependencies: {
  model?: GapGenerationModel;
  embeddingProvider?: DocumentEmbeddingProvider;
} = {}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const assessment = await db.query.assessments.findFirst({
    where: and(
      eq(assessments.id, input.assessmentId),
      eq(assessments.organizationId, input.organizationId),
      eq(assessments.status, "active"),
    ),
  });
  if (
    !assessment?.gapAnalysisReleaseId ||
    !assessment.applicabilityArtifactRevisionId ||
    !assessment.currentRevisionId
  ) {
    throw new ApiError(409, "Submit the pinned gap questionnaire before generation");
  }
  const release = await loadGapAnalysisRelease(
    assessment.gapAnalysisReleaseId,
    input.locale,
  );
  if (!release) throw new ApiError(409, "Pinned gap release is unavailable");
  const applicability = await db.query.generatedArtifactRevisions.findFirst({
    where: eq(
      generatedArtifactRevisions.id,
      assessment.applicabilityArtifactRevisionId,
    ),
  });
  if (!applicability || applicability.status !== "approved") {
    throw new ApiError(409, "Pinned applicability result is not approved");
  }
  const applicabilityOutcome = readOutcome(applicability.result);
  const applicableRequirements = release.requirements.filter((requirement) =>
    requirement.applicabilityOutcomeCodes.includes(applicabilityOutcome),
  );
  const answerRows = await db.query.assessmentAnswers.findMany({
    where: eq(
      assessmentAnswers.assessmentRevisionId,
      assessment.currentRevisionId,
    ),
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
    assessmentRevisionId: assessment.currentRevisionId,
    applicabilityArtifactRevisionId: applicability.id,
    applicabilityInputHash: applicability.inputHash,
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
  });
  const idempotencyKey = contentHash({
    sourceInputHash,
    retryNonce: input.retryNonce ?? "initial",
  });
  const existingRun = await db.query.aiProcessingRuns.findFirst({
    where: and(
      eq(aiProcessingRuns.organizationId, input.organizationId),
      eq(aiProcessingRuns.operationKind, "gap_analysis"),
      eq(aiProcessingRuns.idempotencyKey, idempotencyKey),
    ),
  });
  if (existingRun) return { run: existingRun, reused: true };

  const policy = parseModelPolicy(release.modelPolicy);
  const model = dependencies.model ?? createGapGenerationModel(policy.model);
  const [run] = await db
    .insert(aiProcessingRuns)
    .values({
      organizationId: input.organizationId,
      assessmentRevisionId: assessment.currentRevisionId,
      operationKind: "gap_analysis",
      status: "pending",
      inputHash: sourceInputHash,
      idempotencyKey,
      provider: model.provider,
      model: model.model,
      promptName: release.prompt.name,
      promptVersion: release.prompt.version,
      promptTemplateHash: release.prompt.templateHash,
      renderedInputHash: sourceInputHash,
      responseSchemaVersion: release.prompt.responseSchemaVersion,
      createdBy: input.userId,
    })
    .returning();
  if (!run) throw new ApiError(500, "Could not create AI processing run");
  await db.insert(aiProcessingRunInputs).values([
    {
      runId: run.id,
      sourceType: "assessment_revision",
      sourceId: assessment.currentRevisionId,
      sourceHash: contentHash(answerRows),
    },
    {
      runId: run.id,
      sourceType: "artifact_revision",
      sourceId: applicability.id,
      sourceHash: applicability.inputHash ?? contentHash(applicability.result),
    },
    ...documentRows.map((document) => ({
      runId: run.id,
      sourceType: "document_version" as const,
      sourceId: document.id,
      sourceHash: document.contentHash,
    })),
  ]);
  await db
    .update(aiProcessingRuns)
    .set({ status: "processing", startedAt: new Date() })
    .where(eq(aiProcessingRuns.id, run.id));

  try {
    const promptRequirements: GapPromptRequirement[] = [];
    for (const requirement of applicableRequirements) {
      const citations = questionnaireCitations(
        requirement.questionStableKeys,
        answerRows,
        answerOptionRows,
        release.questions,
      );
      if (selectedVersionIds.length > 0) {
        const evidence = await retrieveDocumentEvidence(
          {
            userId: input.userId,
            organizationId: input.organizationId,
            selectedDocumentVersionIds: selectedVersionIds,
            query: `${requirement.title}\n${requirement.requirementText}`,
          },
          { embeddingProvider: dependencies.embeddingProvider },
        );
        citations.push(
          ...evidence.map((item) => ({
            id: item.citationId,
            sourceType: "document_chunk" as const,
            sourceId: item.chunkId,
            excerpt: item.content,
            pageNumber: item.pageNumber,
            sectionLabel: item.sectionLabel,
          })),
        );
      }
      promptRequirements.push({
        code: requirement.code,
        title: requirement.title,
        requirementText: requirement.requirementText,
        criticality: requirement.criticality,
        legalReferences: requirement.legalReferences,
        citations,
      });
    }

    const findings: GapModelFinding[] = [];
    const renderedInputHashes: string[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    for (const batch of batches(promptRequirements, policy.maxRequirementsPerBatch)) {
      const prompt = buildGapPrompt(batch);
      renderedInputHashes.push(prompt.renderedInputHash);
      const response = await model.generate({ system: prompt.system, prompt: prompt.prompt });
      inputTokens += response.inputTokens ?? 0;
      outputTokens += response.outputTokens ?? 0;
      const citations = batch.flatMap((requirement) => requirement.citations);
      const validated = validateGapModelResponse({
        value: response.value,
        requestedRequirementCodes: batch.map((requirement) => requirement.code),
        citations,
        citationIdsByRequirement: Object.fromEntries(
          batch.map((requirement) => [
            requirement.code,
            requirement.citations.map((citation) => citation.id),
          ]),
        ),
      });
      findings.push(...validated.findings);
    }
    const renderedInputHash = contentHash(renderedInputHashes);
    const persisted = await persistGeneratedGapResult({
      runId: run.id,
      userId: input.userId,
      organizationId: input.organizationId,
      assessmentRevisionId: assessment.currentRevisionId,
      applicabilityArtifactRevisionId: applicability.id,
      release,
      selectedVersionIds,
      promptRequirements,
      findings,
      model,
      sourceInputHash,
      renderedInputHash,
      inputTokens,
      outputTokens,
    });
    return { run: persisted.run, artifactRevision: persisted.revision, reused: false };
  } catch (error) {
    await db.transaction(async (tx) => {
      await tx
        .update(aiProcessingRuns)
        .set({
          status: "failed",
          errorCode: "gap_generation_failed",
          errorMessage: errorMessage(error),
          completedAt: new Date(),
        })
        .where(eq(aiProcessingRuns.id, run.id));
      await tx.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "ai_run.failed",
        entityType: "ai_processing_run",
        entityId: run.id,
        metadata: { error: errorMessage(error) },
      });
    });
    throw error;
  }
}

async function persistGeneratedGapResult(input: {
  runId: string;
  userId: string;
  organizationId: string;
  assessmentRevisionId: string;
  applicabilityArtifactRevisionId: string;
  release: NonNullable<Awaited<ReturnType<typeof loadGapAnalysisRelease>>>;
  selectedVersionIds: string[];
  promptRequirements: GapPromptRequirement[];
  findings: GapModelFinding[];
  model: GapGenerationModel;
  sourceInputHash: string;
  renderedInputHash: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const citationById = new Map(
    input.promptRequirements
      .flatMap((requirement) => requirement.citations)
      .map((citation) => [citation.id, citation]),
  );
  const requirementByCode = new Map(
    input.release.requirements.map((requirement) => [requirement.code, requirement]),
  );
  return db.transaction(async (tx) => {
    let artifact = await tx.query.generatedArtifacts.findFirst({
      where: and(
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.moduleId, input.release.moduleId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
      ),
    });
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
      where: eq(generatedArtifactRevisions.artifactId, artifact.id),
      orderBy: [desc(generatedArtifactRevisions.revisionNumber)],
    });
    const summary = {
      kind: "gap_analysis_result_v1",
      gapAnalysisReleaseId: input.release.id,
      assessmentRevisionId: input.assessmentRevisionId,
      applicabilityArtifactRevisionId: input.applicabilityArtifactRevisionId,
      selectedDocumentVersionIds: input.selectedVersionIds,
      findings: input.findings.map((finding) => {
        const requirement = requireValue(requirementByCode, finding.requirementCode);
        return {
          requirementCode: finding.requirementCode,
          status: finding.status,
          evidenceSufficiency: finding.evidenceSufficiency,
          severity: deriveFindingSeverity(requirement.criticality, finding.status),
          rationale: finding.rationale,
          recommendation: finding.recommendation,
          assumptions: finding.assumptions,
          requiresReview: finding.requiresReview,
          citationIds: finding.citations,
        };
      }),
    };
    const [revision] = await tx
      .insert(generatedArtifactRevisions)
      .values({
        artifactId: artifact.id,
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        parentRevisionId: artifact.currentRevisionId,
        status: "generated",
        result: summary,
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
    await tx.insert(artifactRevisionSources).values([
      {
        artifactRevisionId: revision.id,
        sourceType: "assessment_revision",
        sourceId: input.assessmentRevisionId,
      },
      {
        artifactRevisionId: revision.id,
        sourceType: "artifact_revision",
        sourceId: input.applicabilityArtifactRevisionId,
      },
      ...input.selectedVersionIds.map((sourceId) => ({
        artifactRevisionId: revision.id,
        sourceType: "document_version" as const,
        sourceId,
      })),
    ]);
    for (const finding of input.findings) {
      const requirement = requireValue(requirementByCode, finding.requirementCode);
      const [storedFinding] = await tx
        .insert(gapFindings)
        .values({
          artifactRevisionId: revision.id,
          requirementVersionId: requirement.id,
          status: finding.status,
          evidenceSufficiency: finding.evidenceSufficiency,
          severity: deriveFindingSeverity(requirement.criticality, finding.status),
          rationale: finding.rationale,
          recommendation: finding.recommendation,
          assumptions: finding.assumptions,
          requiresReview: finding.requiresReview,
        })
        .returning();
      if (!storedFinding) throw new Error("Could not persist gap finding");
      if (finding.citations.length > 0) {
        await tx.insert(gapFindingEvidence).values(
          finding.citations.map((citationId) => {
            const citation = requireValue(citationById, citationId);
            return {
              findingId: storedFinding.id,
              citationId,
              sourceType: citation.sourceType,
              assessmentAnswerId:
                citation.sourceType === "assessment_answer" ? citation.sourceId : null,
              documentChunkId:
                citation.sourceType === "document_chunk" ? citation.sourceId : null,
              excerpt: citation.excerpt,
              pageNumber: citation.pageNumber,
              sectionLabel: citation.sectionLabel,
            };
          }),
        );
      }
    }
    await tx
      .update(generatedArtifacts)
      .set({ currentRevisionId: revision.id })
      .where(eq(generatedArtifacts.id, artifact.id));
    const [completedRun] = await tx
      .update(aiProcessingRuns)
      .set({
        status: "succeeded",
        outputArtifactRevisionId: revision.id,
        renderedInputHash: input.renderedInputHash,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        completedAt: new Date(),
      })
      .where(eq(aiProcessingRuns.id, input.runId))
      .returning();
    await tx.insert(auditEvents).values([
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
    ]);
    return { run: completedRun, revision };
  });
}

function questionnaireCitations(
  questionStableKeys: string[],
  answers: Array<typeof assessmentAnswers.$inferSelect>,
  answerOptions: Array<{ answerId: string; option: typeof questionOptions.$inferSelect }>,
  releaseQuestions: NonNullable<Awaited<ReturnType<typeof loadGapAnalysisRelease>>>["questions"],
): SuppliedCitation[] {
  return answers
    .filter((answer) => questionStableKeys.includes(answer.questionStableKey))
    .map((answer) => {
      const question = releaseQuestions.find(
        (candidate) => candidate.id === answer.questionId,
      );
      const selected = answerOptions
        .filter((row) => row.answerId === answer.id)
        .map((row) =>
          question?.options.find((option) => option.id === row.option.id)?.label ??
          row.option.stableValue,
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

function readOutcome(result: unknown) {
  const outcome = (result as { outcome?: unknown })?.outcome;
  if (typeof outcome !== "string") {
    throw new ApiError(409, "Pinned applicability result has no outcome");
  }
  return outcome;
}

function parseModelPolicy(value: unknown) {
  const policy = value as {
    provider?: unknown;
    model?: unknown;
    maxRequirementsPerBatch?: unknown;
  };
  if (
    policy.provider !== "openai" ||
    typeof policy.model !== "string" ||
    !Number.isInteger(policy.maxRequirementsPerBatch) ||
    Number(policy.maxRequirementsPerBatch) < 1
  ) {
    throw new ApiError(500, "Pinned gap model policy is invalid");
  }
  return {
    provider: policy.provider,
    model: policy.model,
    maxRequirementsPerBatch: Number(policy.maxRequirementsPerBatch),
  };
}

function batches<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function requireValue<K, V>(values: Map<K, V>, key: K) {
  const value = values.get(key);
  if (!value) throw new Error(`Required value ${String(key)} is missing`);
  return value;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 2_000);
  return "Unknown gap-generation failure";
}
