import {
  prepareGroundingOperation,
  runGroundedOperation,
  type GroundingExecutionDependencies,
} from "../ai/grounding/gateway";
import {
  resolveGroundingRetrievalQuery,
  type GroundingContextItem,
  type QueryUnit,
} from "../ai/grounding/types";
import type { Locale } from "@/lib/i18n-config";
import type { AtomicGapTriggerPolicy } from "./trigger-policy";
import type { LoadedGapRelease } from "./release-loader";
import {
  CURRENT_GAP_PROMPT_METADATA,
  buildAtomicGapOrganizationRetrievalQuery,
  buildAtomicGapQuery,
  buildAtomicGapRetrievalQuery,
  buildGapCategoryResponseSchema,
  deriveAtomicGapKind,
  gapPrompt,
  gapRepairPrompt,
  normalizeGapCategoryResponse,
  type GapCategoryResponse,
  type GapResponsePolicy,
  type ValidatedCategoryGapResult,
} from "./current-contract";
import {
  coordinateCategoryGeneration,
  generationCallAttemptIdentity,
  generationReservationIdentity,
  parseDurableExecutionAttempt,
  safeGenerationIssues,
} from "../ai/generation";
import { contentHash } from "../compliance";
import { auditEvents } from "@/src/db/schema";
import { db } from "@/src/db";
import {
  createDocumentEmbeddingProvider,
  validateEmbeddings,
} from "@/src/server/documents";
import { resolveOrganizationEmbeddingConfig } from "@/src/server/documents/service";
import { emitGenerationMetric } from "../ai/generation/metrics";
import { configuredCategoryConcurrency } from "../ai/generation/concurrency";

export type AtomicGapRequirementInput = {
  requirement: LoadedGapRelease["requirements"][number];
  determinedStatus:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence";
  policy: AtomicGapTriggerPolicy;
  sourceAssessmentAnswerIdByQuestion: Record<string, string>;
  statementMaximumByQuestion?: Record<string, number>;
  forcedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  forcedRequiresReview?: boolean;
  reviewCorrection?: {
    reason: string;
    resolutionReason?: string;
  };
};

export async function generateAtomicGapBatch(input: {
  actor: { userId: string };
  organizationId: string;
  assessmentRevisionId: string;
  release: LoadedGapRelease;
  requirements: AtomicGapRequirementInput[];
  selectedDocumentVersionIds: string[];
  outputLocale: Locale;
  idempotencyKey: string;
  questionnaireAssertions: Array<{
    answerId: string;
    queryUnitId: string;
    excerpt: string;
  }>;
  asOfDate?: string;
  jobId?: string;
  workerId?: string;
  durableExecutionAttempt: number;
  runOperationKind?: "gap_analysis";
  abortSignal?: AbortSignal;
  onAcceptedCategory?: (categoryCode: string) => Promise<void> | void;
  groundingDependencies?: GroundingExecutionDependencies;
}): Promise<{
  runId: string;
  outputLocale: Locale;
  context: GroundingContextItem[];
  findings: ValidatedCategoryGapResult[];
  runIdsByCategory?: Record<string, string>;
}> {
  return generateAtomicGapCategoriesCurrent(input);
}

async function generateAtomicGapCategoriesCurrent(
  input: Parameters<typeof generateAtomicGapBatch>[0],
): Promise<{
  runId: string;
  outputLocale: Locale;
  context: GroundingContextItem[];
  findings: ValidatedCategoryGapResult[];
  runIdsByCategory: Record<string, string>;
}> {
  const signal = input.abortSignal ?? new AbortController().signal;
  const durableExecutionAttempt = parseDurableExecutionAttempt(
    input.durableExecutionAttempt,
  );
  const contextByCategory = new Map<string, GroundingContextItem[]>();
  const runIdsByCategory: Record<string, string> = {};
  const preparedGrounding = await prepareGroundingOperation(
    {
      operation: "gap_analysis",
      organizationId: input.organizationId,
      workflowReleaseId: input.release.id,
    },
    input.groundingDependencies,
  );
  const initialQueryUnits = new Map(
    input.requirements.map((item) => [
      item.requirement.code,
      currentGapQueryUnit(input, item, "initial"),
    ]),
  );
  // The precomputed vector must come from the organization's own embedder:
  // document retrieval filters rows on that model, so a query embedded by the
  // server default would be compared against a different vector space.
  const preparedEmbeddings = await prepareQueryEmbeddings(
    [...initialQueryUnits.values()],
    input.jobId,
    input.selectedDocumentVersionIds.length > 0,
    input.groundingDependencies?.embeddingProvider ??
      createDocumentEmbeddingProvider(
        (await resolveOrganizationEmbeddingConfig(input.organizationId)).provider,
      ),
  );
  const coordinated = await coordinateCategoryGeneration<
    AtomicGapRequirementInput,
    GapCategoryResponse,
    ValidatedCategoryGapResult
  >({
    signal,
    concurrency: configuredCategoryConcurrency(),
    tasks: input.requirements.map((item) => ({
      categoryCode: item.requirement.code,
      taskId: contentHash({
        operation: input.runOperationKind ?? "gap_analysis",
        revisionId: input.assessmentRevisionId,
        releaseId: input.release.id,
        contract: CURRENT_GAP_PROMPT_METADATA.responseSchemaVersion,
        locale: input.outputLocale,
        categoryCode: item.requirement.code,
        generationReservation: input.idempotencyKey,
      }),
      input: item,
    })),
    async generate({
      task,
      phase,
      rejectedCandidate,
      issues,
      signal: taskSignal,
      providerAttempt,
    }) {
      const item = task.input;
      const reservationIdentity = generationReservationIdentity({
        taskId: task.taskId,
        phase,
      });
      const callAttemptIdentity = generationCallAttemptIdentity({
        reservationIdentity,
        durableExecutionAttempt,
        providerAttempt,
      });
      let responsePolicy: GapResponsePolicy | undefined;
      const queryUnit = phase === "initial"
        ? initialQueryUnits.get(item.requirement.code)!
        : currentGapQueryUnit(input, item, phase, rejectedCandidate);
      const organizationQuery = resolveGroundingRetrievalQuery(
        queryUnit,
        "organization_document",
      );
      const grounded = await runGroundedOperation<GapCategoryResponse>({
        operation: "gap_analysis",
        runOperationKind: input.runOperationKind,
        actor: input.actor,
        organizationId: input.organizationId,
        outputLocale: input.outputLocale,
        workflowReleaseId: input.release.id,
        asOfDate: input.asOfDate ?? new Date().toISOString().slice(0, 10),
        organizationEvidenceVersionIds: input.selectedDocumentVersionIds,
        questionnaireAssertions: input.questionnaireAssertions.filter(
          (assertion) => assertion.queryUnitId === item.requirement.code,
        ),
        queryUnits: [queryUnit],
        systemInstruction:
          phase === "initial"
            ? gapPrompt({
                locale: input.outputLocale,
                semanticContexts: currentGapSemanticContexts(item, input.outputLocale),
              })
            : gapRepairPrompt({
                locale: input.outputLocale,
                categoryCode: item.requirement.code,
                semanticContexts: currentGapSemanticContexts(item, input.outputLocale),
                issues: issues ?? [],
              }),
        outputContract: {
          schema(context) {
            const policy = currentGapResponsePolicy(
              item,
              context,
              input.outputLocale,
            );
            responsePolicy = policy;
            return buildGapCategoryResponseSchema(policy);
          },
          languagePolicy: "localized",
          generatedProse: currentGapGeneratedProse,
          claims(value) {
            const policy =
              responsePolicy ??
              currentGapResponsePolicy(
                item,
                contextByCategory.get(item.requirement.code) ?? [],
                input.outputLocale,
              );
            const claims = Object.entries(value.gaps).flatMap(([key, gaps]) =>
              gaps.map((gap, index) => ({
                key: `atomic-gap:${item.requirement.code}:${key}:${index + 1}`,
                queryUnitId: item.requirement.code,
                kind: "organization" as const,
                binding: false,
                citationIds: [
                  policy.questionnaireCitationIdsByQuestion[key]!,
                  ...gap.supportingOrganizationCitationIds,
                ],
                text: gap.statement,
              })),
            );
            return claims.length
              ? claims
              : [
                  {
                    key: `atomic-gap:${item.requirement.code}:no-gap`,
                    queryUnitId: item.requirement.code,
                    kind: "legal" as const,
                    binding: true,
                    citationIds: [policy.preferredPrimaryLegalCitationId],
                    text: `${item.requirement.code}: no triggering atomic gaps`,
                  },
                ];
          },
          allowConflictingClaim(value) {
            return value.requiresReview || Boolean(item.reviewCorrection);
          },
        },
        idempotencyKey: callAttemptIdentity,
        generationReservationKey: reservationIdentity,
        generationAttemptKey: callAttemptIdentity,
        durableExecutionAttempt,
        providerAttempt,
        assessmentRevisionId: input.assessmentRevisionId,
        jobId: input.jobId,
        expectedLeaseOwner: input.workerId,
        abortSignal: taskSignal,
        promptMetadata: CURRENT_GAP_PROMPT_METADATA,
        precomputedQueryEmbeddings: phase === "initial"
          ? { organizationDocument: preparedEmbeddings.get(organizationQuery) }
          : undefined,
        preparedGrounding,
      }, input.groundingDependencies);
      contextByCategory.set(item.requirement.code, grounded.context);
      runIdsByCategory[item.requirement.code] = grounded.runId;
      await db.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.actor.userId,
        eventType: "ai_generation.category_run",
        entityType: "ai_processing_run",
        entityId: grounded.runId,
        metadata: {
          categoryCode: item.requirement.code,
          phase,
          providerAttempt,
          recovered: grounded.recovered === true,
        },
      });
      return grounded.output;
    },
    validate(candidate, task) {
      try {
        const normalized = normalizeGapCategoryResponse({
          value: candidate,
          policy: currentGapResponsePolicy(
            task.input,
            contextByCategory.get(task.categoryCode) ?? [],
            input.outputLocale,
          ),
        });
        return {
          valid: true,
          value: normalized.value,
          normalizedIssueCodes: normalized.normalizationCodes,
        };
      } catch (error) {
        return {
          valid: false,
          failureClass: "repairable_content",
          issues:
            error &&
            typeof error === "object" &&
            "issues" in error &&
            Array.isArray(error.issues)
              ? safeGenerationIssues(error.issues)
              : [{ code: "content_invalid", path: [] }],
        };
      }
    },
    async onDiagnostic(diagnostic) {
      if (!input.jobId) return;
      await db.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.actor.userId,
        eventType: "ai_generation.category_diagnostic",
        entityType: "background_job",
        entityId: input.jobId,
        metadata: diagnostic,
      });
    },
    async onAcceptedCategory(_output, task) {
      await input.onAcceptedCategory?.(task.categoryCode);
    },
  });
  const contexts = [...contextByCategory.values()].flat();
  const firstRunId = input.requirements
    .map((item) => runIdsByCategory[item.requirement.code])
    .find(Boolean);
  if (!firstRunId) throw new Error("Gap category generation produced no run");
  return {
    runId: firstRunId,
    outputLocale: input.outputLocale,
    context: contexts,
    findings: coordinated.categories,
    runIdsByCategory,
  };
}

async function prepareQueryEmbeddings(
  queryUnits: QueryUnit[],
  jobId?: string,
  includeOrganizationDocuments = true,
  embeddingProvider?: ReturnType<typeof createDocumentEmbeddingProvider>,
) {
  // Only organization documents are retrieved by similarity. Legal grounding
  // resolves reviewed provision bindings and ranks lexically, so embedding a
  // legal query here would be a wasted provider call.
  const queries = includeOrganizationDocuments
    ? [
        ...new Set(
          queryUnits.map((unit) =>
            resolveGroundingRetrievalQuery(unit, "organization_document"),
          ),
        ),
      ]
    : [];
  const provider = embeddingProvider ?? createDocumentEmbeddingProvider();
  const vectors = new Map<string, number[]>();
  const batchSize = embeddingBatchSize();
  let callCount = 0;
  for (let offset = 0; offset < queries.length; offset += batchSize) {
    const batch = queries.slice(offset, offset + batchSize);
    const startedAt = Date.now();
    const embeddings = await provider.embed(batch, "query");
    validateEmbeddings(embeddings, batch.length, provider.dimensions);
    callCount += 1;
    emitGenerationMetric({
      name: "embedding_call_ms",
      value: Date.now() - startedAt,
      jobId,
      batchSize: batch.length,
      callCount,
    });
    batch.forEach((query, index) => vectors.set(query, embeddings[index]!));
  }
  return vectors;
}

function embeddingBatchSize() {
  const configured = Number(process.env.AI_EMBEDDING_BATCH_SIZE ?? "64");
  if (!Number.isInteger(configured) || configured < 1 || configured > 512) {
    throw new Error("AI_EMBEDDING_BATCH_SIZE must be an integer between 1 and 512");
  }
  return configured;
}

function currentGapQueryUnit(
  input: Parameters<typeof generateAtomicGapBatch>[0],
  item: AtomicGapRequirementInput,
  phase: "initial" | "repair",
  rejectedCandidate?: GapCategoryResponse,
) {
  const base = {
    id: item.requirement.code,
    query: buildAtomicGapQuery({
      requirement: item.requirement,
      policy: provisionalResponsePolicy(item, input.outputLocale),
      questions: input.release.questions.map((question) => ({
        stableKey: question.stableKey,
        text: question.questionText,
      })),
      reviewCorrection: item.reviewCorrection,
    }),
    retrievalQuery: buildAtomicGapRetrievalQuery({
      requirement: item.requirement,
      triggerQuestionTexts: item.policy.triggeringQuestions.map(
        (question) => question.text,
      ),
      preferredMappedLegalProvisionKeys:
        item.policy.preferredLegalProvisionKeys,
    }),
    organizationRetrievalQuery: buildAtomicGapOrganizationRetrievalQuery({
      requirement: item.requirement,
      categoryQuestionTexts: input.release.questions
        .filter((question) =>
          item.requirement.questionStableKeys.includes(question.stableKey),
        )
        .map((question) => question.questionText),
    }),
    preferredMappedLegalProvisionIds: item.policy.preferredLegalProvisionIds,
    preferredMappedLegalProvisionKeys: item.policy.preferredLegalProvisionKeys,
    legalTierLimits: {
      primary_authority: 0,
      official_guidance: 0,
      curated_secondary: 0,
    } as const,
  };
  return phase === "repair"
    ? {
        ...base,
        query: JSON.stringify({
          pinnedCategoryInput: JSON.parse(base.query),
          rejectedCandidate,
        }),
      }
    : base;
}

function baseGapResponsePolicy(
  item: AtomicGapRequirementInput,
  context: GroundingContextItem[],
  outputLocale: Locale,
) {
  const supplied = context.filter(
    (candidate) => candidate.queryUnitId === item.requirement.code,
  );
  const legal = supplied.find(
    (candidate) =>
      candidate.channel === "legal" &&
      candidate.metadata.selectionRole === "mapped_primary",
  );
  if (!legal) throw new Error("Preferred mapped primary citation is missing");
  return {
    requirementCode: item.requirement.code,
    outputLocale,
    statementBasis: provisionalResponsePolicy(item, outputLocale)
      .statementBasis,
    statementMaximumByQuestion: item.statementMaximumByQuestion,
    admittedOrganizationCitationIds: supplied
      .filter((candidate) => candidate.channel === "organization_document")
      .map((candidate) => candidate.citationId),
    questionnaireCitationIdsByQuestion: Object.fromEntries(
      item.policy.triggeringQuestions.map((trigger) => {
        const answerId =
          item.sourceAssessmentAnswerIdByQuestion[trigger.stableKey];
        const citation = supplied.find(
          (candidate) =>
            candidate.channel === "questionnaire_assertion" &&
            candidate.sourceId === answerId,
        );
        if (!citation) throw new Error("Questionnaire citation is missing");
        return [trigger.stableKey, citation.citationId];
      }),
    ),
    preferredPrimaryLegalCitationId: legal.citationId,
    forcedEvidenceSufficiency: item.forcedEvidenceSufficiency,
    forcedRequiresReview: item.forcedRequiresReview,
  };
}

function currentGapResponsePolicy(
  item: AtomicGapRequirementInput,
  context: GroundingContextItem[],
  outputLocale: Locale,
): GapResponsePolicy {
  return {
    ...baseGapResponsePolicy(item, context, outputLocale),
    semanticContextByQuestion: Object.fromEntries(
      currentGapSemanticContexts(item, outputLocale).map((semantic) => [
        semantic.questionStableKey,
        semantic,
      ]),
    ),
  };
}

function currentGapSemanticContexts(
  item: AtomicGapRequirementInput,
  outputLocale: Locale,
) {
  const basis = provisionalResponsePolicy(item, outputLocale).statementBasis;
  const kindByKey = new Map(
    basis.triggeringQuestions.map((trigger) => [
      trigger.stableKey,
      trigger.kind,
    ]),
  );
  return item.policy.triggeringQuestions.map((trigger) => {
    if (trigger.stableValue === "fully_implemented") {
      throw new Error(
        `Satisfied question ${trigger.stableKey} cannot be a Gap trigger`,
      );
    }
    return {
      locale: outputLocale,
      questionStableKey: trigger.stableKey,
      questionText: trigger.text,
      selectedAnswer: trigger.stableValue,
      expectedKind:
        kindByKey.get(trigger.stableKey) ?? missingGapKind(trigger.stableKey),
    };
  });
}

function missingGapKind(stableKey: string): never {
  throw new Error(`Server-owned Gap kind is missing for ${stableKey}`);
}

function currentGapGeneratedProse(value: GapCategoryResponse) {
  return [
    ...Object.values(value.gaps).flatMap((gaps) =>
      gaps.map((gap) => gap.statement),
    ),
    ...(value.reviewNotice ? [value.reviewNotice] : []),
    ...value.assumptions,
    ...value.contradictions,
  ];
}

function provisionalResponsePolicy(
  item: AtomicGapRequirementInput,
  outputLocale: Locale,
) {
  const allNotApplicable = item.policy.triggeringQuestions.every(
    (question) => question.stableValue === "not_applicable",
  );
  return {
    requirementCode: item.requirement.code,
    outputLocale,
    status: item.determinedStatus,
    statementBasis: {
      version: "1" as const,
      triggeringQuestions: item.policy.triggeringQuestions.map((trigger) => ({
        stableKey: trigger.stableKey,
        sourceAssessmentAnswerId:
          item.sourceAssessmentAnswerIdByQuestion[trigger.stableKey] ??
          missingAnswer(trigger.stableKey),
        kind: deriveAtomicGapKind(trigger.stableValue, allNotApplicable),
      })),
      satisfiedQuestionStableKeys: item.policy.satisfiedQuestionStableKeys,
    },
    permittedCitationIds: [],
    questionnaireCitationIdsByQuestion: {},
    admittedOrganizationCitationIds: [],
    preferredPrimaryLegalCitationIds: [],
    forcedEvidenceSufficiency: item.forcedEvidenceSufficiency,
    forcedRequiresReview: item.forcedRequiresReview,
  };
}

function missingAnswer(stableKey: string): never {
  throw new Error(`Source assessment answer is missing for ${stableKey}`);
}
