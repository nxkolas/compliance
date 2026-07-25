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
  buildGapModelResponseSchema,
  extractGapGeneratedProse,
  normalizeGroundedGapModelResponse,
  type GapModelFinding,
  type GroundedGapModelResponse,
  type SuppliedCitation,
  validateGapModelResponse,
} from "./generation-schema";
import type { GapPromptRequirement } from "./prompt-builder";
import { loadGapAnalysisRelease } from "./release-loader";
import { runGroundedOperation } from "../ai/grounding/gateway";
import { assertOutputLocaleMatches } from "../ai/grounding/language-policy";
import { assertGapInputsMutable } from "./lifecycle-guards";
import { buildGeneratedGapRevisionMetadata } from "./gap-revision-metadata";
import { resolveGapGenerationPrerequisites } from "./applicability-eligibility";

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
  const assessment = await db.query.assessments.findFirst({ columns: { id: true, organizationId: true, moduleId: true, questionnaireId: true, checkReleaseId: true, gapAnalysisReleaseId: true, applicabilityArtifactRevisionId: true, currentRevisionId: true, status: true, createdBy: true, createdAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.id, input.assessmentId),
      eq(table.organizationId, input.organizationId),
      eq(table.status, "active"),
    )) ?? operators.sql`true` },
  });
  if (
    !assessment?.gapAnalysisReleaseId ||
    !assessment.applicabilityArtifactRevisionId ||
    !(input.assessmentRevisionId ?? assessment.currentRevisionId)
  ) {
    throw new ApiError(409, "Submit the pinned gap questionnaire before generation");
  }
  if (!input.jobId) {
    await assertGapInputsMutable({
      organizationId: input.organizationId,
      moduleId: assessment.moduleId,
    });
  }
  const assessmentRevisionId = input.assessmentRevisionId ?? assessment.currentRevisionId!;
  const assessmentRevision = await db.query.assessmentRevisions.findFirst({ columns: { id: true, assessmentId: true, questionnaireVersionId: true, revisionNumber: true, parentRevisionId: true, status: true, createdBy: true, createdAt: true, submittedAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.id, assessmentRevisionId),
      eq(table.assessmentId, assessment.id),
    )) ?? operators.sql`true` },
  });
  if (!assessmentRevision) {
    throw new ApiError(409, "Pinned gap questionnaire revision is unavailable");
  }
  const release = await loadGapAnalysisRelease(
    assessment.gapAnalysisReleaseId,
    input.locale,
  );
  if (!release) throw new ApiError(409, "Pinned gap release is unavailable");
  const applicability = await db.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(
      table.id,
      assessment.applicabilityArtifactRevisionId!,
    )) ?? operators.sql`true` },
  });
  const {
    artifact: applicabilityArtifact,
    requirements: applicableRequirements,
  } =
    resolveGapGenerationPrerequisites({
      compatibleCheckReleaseId: release.compatibleCheckReleaseId,
      artifact: applicability,
      requirements: release.requirements,
    });
  const answerRows = await db.query.assessmentAnswers.findMany({ columns: { id: true, assessmentRevisionId: true, questionId: true, questionStableKey: true, textValue: true, numberValue: true, booleanValue: true, dateValue: true, structuredValue: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(
      table.assessmentRevisionId,
      assessmentRevisionId,
    )) ?? operators.sql`true` },
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
  });
  const idempotencyKey = contentHash({
    sourceInputHash,
    retryNonce: input.retryNonce ?? "initial",
  });
  const existingRun = await db.query.aiProcessingRuns.findFirst({ columns: { id: true, organizationId: true, assessmentRevisionId: true, operationKind: true, status: true, outputLocale: true, attemptCount: true, languageValidation: true, inputHash: true, idempotencyKey: true, provider: true, model: true, promptName: true, promptVersion: true, promptTemplateHash: true, renderedInputHash: true, responseSchemaVersion: true, inputTokens: true, outputTokens: true, cachedInputTokens: true, validatedOutput: true, jobId: true, providerPolicyVersion: true, corpusReleaseSetHash: true, provenanceStatus: true, cancellationRequestedAt: true, outputArtifactRevisionId: true, errorCode: true, errorMessage: true, createdBy: true, createdAt: true, startedAt: true, completedAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.organizationId, input.organizationId),
      eq(table.operationKind, "gap_analysis"),
      eq(table.idempotencyKey, idempotencyKey),
    )) ?? operators.sql`true` },
  });
  if (existingRun) {
    assertOutputLocaleMatches(existingRun.outputLocale, input.locale, {
      runId: existingRun.id,
    });
    const artifactRevision = existingRun.outputArtifactRevisionId
      ? await db.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
          where: { RAW: (table, operators) => (eq(
            table.id,
             existingRun.outputArtifactRevisionId!,
          )) ?? operators.sql`true` },
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
    outputLocale: input.input.locale,
    workflowReleaseId: input.release.id,
    asOfDate: input.input.asOfDate ?? new Date().toISOString().slice(0, 10),
    organizationEvidenceVersionIds: input.selectedVersionIds,
    questionnaireAssertions,
    queryUnits,
    outputContract: {
      schema: buildGapModelResponseSchema(queryUnits.map((unit) => unit.id)),
      languagePolicy: "localized",
      generatedProse: extractGapGeneratedProse,
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
  if (grounded.outputLocale !== input.input.locale) {
    throw new ApiError(
      409,
      "Accepted AI output locale conflicts with the generation input",
      undefined,
      "GROUNDING_LOCALE_CONFLICT",
    );
  }
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
  await Promise.all([
    db.insert(aiProcessingRunAssessmentInputs).values({
      runId: grounded.runId,
      assessmentRevisionId: input.assessmentRevisionId,
      sourceHash: contentHash(input.answerRows),
    }).onConflictDoNothing(),
    db.insert(aiProcessingRunArtifactInputs).values({
      runId: grounded.runId,
      artifactRevisionId: input.applicability.id,
      sourceHash: input.applicability.inputHash ?? contentHash(input.applicability.result),
    }).onConflictDoNothing(),
    input.documentRows.length
      ? db.insert(aiProcessingRunDocumentInputs).values(
          input.documentRows.map((document) => ({
            runId: grounded.runId,
            documentVersionId: document.id,
            sourceHash: document.contentHash,
          })),
        ).onConflictDoNothing()
      : Promise.resolve(),
  ]);
  const run = await db.query.aiProcessingRuns.findFirst({ columns: { id: true, organizationId: true, assessmentRevisionId: true, operationKind: true, status: true, outputLocale: true, attemptCount: true, languageValidation: true, inputHash: true, idempotencyKey: true, provider: true, model: true, promptName: true, promptVersion: true, promptTemplateHash: true, renderedInputHash: true, responseSchemaVersion: true, inputTokens: true, outputTokens: true, cachedInputTokens: true, validatedOutput: true, jobId: true, providerPolicyVersion: true, corpusReleaseSetHash: true, provenanceStatus: true, cancellationRequestedAt: true, outputArtifactRevisionId: true, errorCode: true, errorMessage: true, createdBy: true, createdAt: true, startedAt: true, completedAt: true }, where: { RAW: (table, operators) => (eq(table.id, grounded.runId)) ?? operators.sql`true` } });
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
    outputLocale: input.input.locale,
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
  outputLocale: Locale;
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
    let artifact = await tx.query.generatedArtifacts.findFirst({ columns: { id: true, organizationId: true, moduleId: true, artifactType: true, currentRevisionId: true, acceptedRevisionId: true, createdAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.organizationId, input.organizationId),
        eq(table.moduleId, input.release.moduleId),
        eq(table.artifactType, "gap_analysis_result"),
      )) ?? operators.sql`true` },
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
    const latest = await tx.query.generatedArtifactRevisions.findFirst({ columns: { id: true, artifactId: true, revisionNumber: true, parentRevisionId: true, status: true, result: true, outputLocale: true, modelName: true, promptVersion: true, ruleSetId: true, checkReleaseId: true, gapAnalysisReleaseId: true, evaluatorKind: true, outcomeCode: true, evaluatedAt: true, inputHash: true, generatedBy: true, createdBy: true, approvedBy: true, approvedAt: true, createdAt: true },
      where: { RAW: (table, operators) => (eq(table.artifactId, artifact.id)) ?? operators.sql`true` },
      orderBy: { revisionNumber: "desc" },
    });
    const summary = buildGeneratedGapRevisionMetadata({
      outputLocale: input.outputLocale,
      expectedRequirementVersionIds: input.findings.map((finding) =>
        requireValue(requirementByCode, finding.requirementCode).id
      ),
      findingDiagnostics: input.findings.map((finding) => {
        const requirement = requireValue(requirementByCode, finding.requirementCode);
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

function requireValue<K, V>(values: Map<K, V>, key: K) {
  const value = values.get(key);
  if (!value) throw new Error(`Required value ${String(key)} is missing`);
  return value;
}
