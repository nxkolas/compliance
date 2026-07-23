import { db } from "@/src/db";
import {
  aiProcessingRunInputs,
  aiProcessingRuns,
  artifactRevisionSources,
  assessmentAnswerOptions,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  auditEvents,
  backgroundJobs,
  documentVersions,
  documents,
  gapFindingEvidence,
  gapFindings,
  gapReassessmentDrafts,
  generatedArtifactRevisions,
  generatedArtifacts,
  questionOptions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contentHash } from "../compliance/publishing/canonical-json";
import { ApiError } from "../api/errors";
import { assertCanContributeToOrganization } from "../organizations/service";
import {
  deriveFindingSeverity,
  buildGapModelResponseSchema,
  normalizeGroundedGapModelResponse,
  type GapModelFinding,
  type GroundedGapModelResponse,
  type SuppliedCitation,
  validateGapModelResponse,
} from "./generation-schema";
import type { GapPromptRequirement } from "./prompt-builder";
import { loadGapAnalysisRelease } from "./release-loader";
import { runGroundedOperation } from "../ai/grounding/gateway";

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
}) {
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
    !(input.assessmentRevisionId ?? assessment.currentRevisionId)
  ) {
    throw new ApiError(409, "Submit the pinned gap questionnaire before generation");
  }
  const assessmentRevisionId = input.assessmentRevisionId ?? assessment.currentRevisionId!;
  const assessmentRevision = await db.query.assessmentRevisions.findFirst({
    where: and(
      eq(assessmentRevisions.id, assessmentRevisionId),
      eq(assessmentRevisions.assessmentId, assessment.id),
    ),
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
      assessmentRevisionId,
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
    assessmentRevisionId,
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
  if (existingRun) {
    const artifactRevision = existingRun.outputArtifactRevisionId
      ? await db.query.generatedArtifactRevisions.findFirst({
          where: eq(
            generatedArtifactRevisions.id,
            existingRun.outputArtifactRevisionId,
          ),
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
      applicability,
      applicableRequirements,
      answerRows,
      answerOptionRows,
      documentRows,
      selectedVersionIds,
      sourceInputHash,
      idempotencyKey,
    });

}

async function generateGroundedGapResult(input: {
  input: Parameters<typeof generateGapAnalysis>[0];
  release: NonNullable<Awaited<ReturnType<typeof loadGapAnalysisRelease>>>;
  assessmentRevisionId: string;
  applicability: typeof generatedArtifactRevisions.$inferSelect;
  applicableRequirements: NonNullable<Awaited<ReturnType<typeof loadGapAnalysisRelease>>>["requirements"];
  answerRows: Array<typeof assessmentAnswers.$inferSelect>;
  answerOptionRows: Array<{ answerId: string; option: typeof questionOptions.$inferSelect }>;
  documentRows: Array<{ id: string; contentHash: string; organizationId: string }>;
  selectedVersionIds: string[];
  sourceInputHash: string;
  idempotencyKey: string;
}) {
  const queryUnits = input.applicableRequirements.map((requirement) => ({
    id: requirement.code,
    query: `${requirement.title}\n${requirement.requirementText}\nLegal references: ${JSON.stringify(requirement.legalReferences)}`,
  }));
  const questionnaireAssertions = input.applicableRequirements.flatMap((requirement) =>
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
  const grounded = await runGroundedOperation<GroundedGapModelResponse>({
    operation: "gap_analysis",
    actor: { userId: input.input.userId },
    organizationId: input.input.organizationId,
    workflowReleaseId: input.release.id,
    asOfDate: input.input.asOfDate ?? new Date().toISOString().slice(0, 10),
    organizationEvidenceVersionIds: input.selectedVersionIds,
    questionnaireAssertions,
    queryUnits,
    outputContract: {
      schema: buildGapModelResponseSchema(queryUnits.map((unit) => unit.id)),
      claims(output) {
        return normalizeGroundedGapModelResponse(output).findings.map((finding) => ({
          key: `gap:${finding.requirementCode}`,
          queryUnitId: finding.requirementCode,
          kind: "legal" as const,
          binding: true,
          citationIds: finding.citations,
          text: JSON.stringify({
            status: finding.status,
            rationale: finding.rationale,
            recommendation: finding.recommendation,
          }),
        }));
      },
      allowConflictingClaim(output, claim) {
        return normalizeGroundedGapModelResponse(output).findings.some((finding) =>
          finding.requirementCode === claim.queryUnitId && finding.requiresReview,
        );
      },
    },
    idempotencyKey: input.idempotencyKey,
    assessmentRevisionId: input.assessmentRevisionId,
    jobId: input.input.jobId,
  });
  try {
  const citations: SuppliedCitation[] = grounded.context.map((item) => ({
    id: item.citationId,
    sourceType: item.channel === "legal"
      ? "legal_source_chunk"
      : item.channel === "organization_document"
        ? "document_chunk"
        : "assessment_answer",
    sourceId: item.sourceId,
    excerpt: item.excerpt,
    pageNumber: typeof item.metadata.pageNumber === "number" ? item.metadata.pageNumber : null,
    sectionLabel: typeof item.metadata.sectionPath === "string" ? item.metadata.sectionPath : null,
  }));
  const findings = validateGapModelResponse({
    value: normalizeGroundedGapModelResponse(grounded.output),
    requestedRequirementCodes: queryUnits.map((unit) => unit.id),
    citations,
    citationIdsByRequirement: Object.fromEntries(queryUnits.map((unit) => [
      unit.id,
      grounded.context.filter((item) => item.queryUnitId === unit.id).map((item) => item.citationId),
    ])),
  }).findings;
  await db.insert(aiProcessingRunInputs).values([
    {
      runId: grounded.runId,
      sourceType: "assessment_revision",
      sourceId: input.assessmentRevisionId,
      sourceHash: contentHash(input.answerRows),
    },
    {
      runId: grounded.runId,
      sourceType: "artifact_revision",
      sourceId: input.applicability.id,
      sourceHash: input.applicability.inputHash ?? contentHash(input.applicability.result),
    },
    ...input.documentRows.map((document) => ({
      runId: grounded.runId,
      sourceType: "document_version" as const,
      sourceId: document.id,
      sourceHash: document.contentHash,
    })),
  ]).onConflictDoNothing();
  const run = await db.query.aiProcessingRuns.findFirst({ where: eq(aiProcessingRuns.id, grounded.runId) });
  if (!run) throw new Error("Grounded AI run was not persisted");
  const promptRequirements = input.applicableRequirements.map((requirement) => ({
    code: requirement.code,
    title: requirement.title,
    requirementText: requirement.requirementText,
    criticality: requirement.criticality,
    legalReferences: requirement.legalReferences,
    citations: citations.filter((citation) => grounded.context.some(
      (item) => item.queryUnitId === requirement.code && item.citationId === citation.id,
    )),
  }));
  const persisted = await persistGeneratedGapResult({
    runId: grounded.runId,
    userId: input.input.userId,
    organizationId: input.input.organizationId,
    assessmentRevisionId: input.assessmentRevisionId,
    applicabilityArtifactRevisionId: input.applicability.id,
    release: input.release,
    selectedVersionIds: input.selectedVersionIds,
    promptRequirements,
    findings,
    model: { model: run.model ?? "grounded-provider" },
    sourceInputHash: input.sourceInputHash,
    renderedInputHash: run.renderedInputHash,
    inputTokens: run.inputTokens ?? 0,
    outputTokens: run.outputTokens ?? 0,
    jobId: input.input.jobId,
  });
  return { run: persisted.run, artifactRevision: persisted.revision, reused: false };
  } catch (error) {
    await db.update(aiProcessingRuns).set({
      status: "failed",
      errorCode: error instanceof ApiError ? error.code : "GAP_PERSISTENCE_FAILED",
      errorMessage: "Grounded Gap result persistence failed.",
      completedAt: new Date(),
    }).where(and(
      eq(aiProcessingRuns.id, grounded.runId),
      eq(aiProcessingRuns.status, "processing"),
    ));
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
  model: { model: string };
  sourceInputHash: string;
  renderedInputHash: string;
  inputTokens: number;
  outputTokens: number;
  jobId?: string;
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
    if (input.jobId) {
      const [job] = await tx.select({ state: backgroundJobs.state }).from(backgroundJobs)
        .where(eq(backgroundJobs.id, input.jobId)).limit(1).for("update");
      if (!job || job.state === "cancellation_requested" || job.state === "cancelled") {
        const cancellation = new Error("Gap generation was cancelled before persistence");
        cancellation.name = "JobCancellationError";
        throw cancellation;
      }
      if (job.state !== "running") throw new Error("Gap generation job no longer owns persistence");
    }
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
          contradictions: finding.contradictions,
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
              legalSourceChunkId:
                citation.sourceType === "legal_source_chunk" ? citation.sourceId : null,
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
        .where(and(
          eq(gapReassessmentDrafts.generationJobId, input.jobId),
          eq(gapReassessmentDrafts.status, "locked"),
        ))
        .returning({ id: gapReassessmentDrafts.id });
      if (!draft) throw new Error("Gap reassessment draft no longer owns persistence");
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
          resultType: "generated_artifact_revision",
          resultId: revision.id,
          leaseOwner: null,
          leaseExpiresAt: null,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(backgroundJobs.id, input.jobId),
          eq(backgroundJobs.state, "running"),
        ))
        .returning({ id: backgroundJobs.id });
      if (!completedJob) throw new Error("Gap generation job no longer owns persistence");
    }
    await tx.insert(auditEvents).values(events);
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

function requireValue<K, V>(values: Map<K, V>, key: K) {
  const value = values.get(key);
  if (!value) throw new Error(`Required value ${String(key)} is missing`);
  return value;
}
