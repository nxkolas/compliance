import {
  prepareGroundingOperation,
  runGroundedOperation,
} from "../ai/grounding/gateway";
import {
  resolveGroundingRetrievalQuery,
  type GroundingContextItem,
  type QueryUnit,
} from "../ai/grounding/types";
import type { Locale } from "@/lib/i18n-config";
import {
  buildGapModelResponseSchemaV7,
  deriveAtomicGapKind,
  normalizeGroundedGapModelResponseV7,
  type GapResponsePolicyV7,
  type GroundedGapModelResponseV7,
  type ValidatedCategoryGapResult,
} from "./generation-schema-v7";
import type { AtomicGapTriggerPolicy } from "./trigger-policy";
import { atomicGapGroundedClaims } from "./grounded-claims";
import {
  buildAtomicGapQuery,
  buildAtomicGapOrganizationRetrievalQuery,
  buildAtomicGapRetrievalQuery,
  GAP_PROMPT_V7_NAME,
  GAP_PROMPT_V7_TEMPLATE,
  GAP_PROMPT_V7_TEMPLATE_HASH,
  GAP_PROMPT_V7_VERSION,
  GAP_RESPONSE_SCHEMA_V7_VERSION,
} from "./prompt-contract-v7";
import type { LoadedGapRelease } from "./release-loader";
import {
  buildGapCategoryResponseSchemaV8,
  normalizeGapCategoryResponseV8,
  type GapCategoryResponseV8,
  type GapResponsePolicyV8,
} from "./generation-schema-v8";
import {
  GAP_PROMPT_V8_TEMPLATE_HASH,
  GAP_PROMPT_V8_NAME,
  GAP_PROMPT_V8_VERSION,
  GAP_RESPONSE_SCHEMA_V8_VERSION,
  gapPromptV8,
  gapRepairPromptV8,
} from "./prompt-contract-v8";
import {
  buildGapCategoryResponseSchemaV9,
  normalizeGapCategoryResponseV9,
  type GapResponsePolicyV9,
} from "./generation-schema-v9";
import {
  GAP_PROMPT_V9_TEMPLATE_HASH,
  GAP_PROMPT_V9_NAME,
  GAP_PROMPT_V9_VERSION,
  GAP_RESPONSE_SCHEMA_V9_VERSION,
  gapPromptV9,
  gapRepairPromptV9,
} from "./prompt-contract-v9";
import {
  buildGapCategoryResponseSchemaV10,
  normalizeGapCategoryResponseV10,
} from "./generation-schema-v10";
import {
  GAP_PROMPT_V10_TEMPLATE_HASH,
  GAP_PROMPT_V10_NAME,
  GAP_PROMPT_V10_VERSION,
  GAP_RESPONSE_SCHEMA_V10_VERSION,
  gapPromptV10,
  gapRepairPromptV10,
} from "./prompt-contract-v10";
import {
  buildGapCategoryResponseSchemaV11,
  normalizeGapCategoryResponseV11,
} from "./generation-schema-v11";
import {
  GAP_PROMPT_V11_TEMPLATE_HASH,
  GAP_PROMPT_V11_NAME,
  GAP_PROMPT_V11_VERSION,
  GAP_RESPONSE_SCHEMA_V11_VERSION,
  gapPromptV11,
  gapRepairPromptV11,
} from "./prompt-contract-v11";
import {
  buildGapCategoryResponseSchemaV12,
  normalizeGapCategoryResponseV12,
} from "./generation-schema-v12";
import {
  GAP_PROMPT_V12_TEMPLATE_HASH,
  GAP_PROMPT_V12_NAME,
  GAP_PROMPT_V12_VERSION,
  GAP_RESPONSE_SCHEMA_V12_VERSION,
  gapPromptV12,
  gapRepairPromptV12,
} from "./prompt-contract-v12";
import {
  coordinateCategoryGeneration,
  safeGenerationIssues,
} from "../ai/generation";
import { contentHash } from "../compliance";
import { auditEvents } from "@/src/db/schema";
import { db } from "@/src/db";
import {
  createDocumentEmbeddingProvider,
  validateEmbeddings,
} from "@/src/server/documents";
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
  runOperationKind?: "gap_analysis";
  abortSignal?: AbortSignal;
  onAcceptedCategory?: (categoryCode: string) => Promise<void> | void;
}): Promise<{
  runId: string;
  outputLocale: Locale;
  context: GroundingContextItem[];
  findings: ValidatedCategoryGapResult[];
  runIdsByCategory?: Record<string, string>;
}> {
  if (
    input.release.prompt.version === GAP_PROMPT_V12_VERSION &&
    input.release.prompt.responseSchemaVersion ===
      GAP_RESPONSE_SCHEMA_V12_VERSION &&
    input.release.prompt.templateHash === GAP_PROMPT_V12_TEMPLATE_HASH
  ) {
    return generateAtomicGapCategoriesVersioned(input, "12");
  }
  if (
    input.release.prompt.version === GAP_PROMPT_V11_VERSION &&
    input.release.prompt.responseSchemaVersion ===
      GAP_RESPONSE_SCHEMA_V11_VERSION &&
    input.release.prompt.templateHash === GAP_PROMPT_V11_TEMPLATE_HASH
  ) {
    return generateAtomicGapCategoriesVersioned(input, "11");
  }
  if (
    input.release.prompt.version === GAP_PROMPT_V10_VERSION &&
    input.release.prompt.responseSchemaVersion ===
      GAP_RESPONSE_SCHEMA_V10_VERSION &&
    input.release.prompt.templateHash === GAP_PROMPT_V10_TEMPLATE_HASH
  ) {
    return generateAtomicGapCategoriesVersioned(input, "10");
  }
  if (
    input.release.prompt.version === GAP_PROMPT_V9_VERSION &&
    input.release.prompt.responseSchemaVersion ===
      GAP_RESPONSE_SCHEMA_V9_VERSION &&
    input.release.prompt.templateHash === GAP_PROMPT_V9_TEMPLATE_HASH
  ) {
    return generateAtomicGapCategoriesVersioned(input, "9");
  }
  if (
    input.release.prompt.version === GAP_PROMPT_V8_VERSION &&
    input.release.prompt.responseSchemaVersion ===
      GAP_RESPONSE_SCHEMA_V8_VERSION &&
    input.release.prompt.templateHash === GAP_PROMPT_V8_TEMPLATE_HASH
  ) {
    return generateAtomicGapCategoriesVersioned(input, "8");
  }
  if (
    input.release.prompt.version !== GAP_PROMPT_V7_VERSION ||
    input.release.prompt.responseSchemaVersion !==
      GAP_RESPONSE_SCHEMA_V7_VERSION ||
    input.release.prompt.templateHash !== GAP_PROMPT_V7_TEMPLATE_HASH
  ) {
    throw new Error("Atomic Gap generation requires the immutable v7 contract");
  }
  const queryUnits = input.requirements.map((item) => ({
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
    },
  }));
  let responsePolicies: GapResponsePolicyV7[] = [];
  const grounded = await runGroundedOperation<GroundedGapModelResponseV7>({
    operation: "gap_analysis",
    runOperationKind: input.runOperationKind,
    actor: input.actor,
    organizationId: input.organizationId,
    outputLocale: input.outputLocale,
    workflowReleaseId: input.release.id,
    asOfDate: input.asOfDate ?? new Date().toISOString().slice(0, 10),
    organizationEvidenceVersionIds: input.selectedDocumentVersionIds,
    questionnaireAssertions: input.questionnaireAssertions,
    queryUnits,
    systemInstruction: GAP_PROMPT_V7_TEMPLATE,
    outputContract: {
      schema(context) {
        responsePolicies = buildResponsePolicies(
          input.requirements,
          context,
          input.outputLocale,
        );
        return buildGapModelResponseSchemaV7(responsePolicies);
      },
      languagePolicy: "localized",
      generatedProse: extractAtomicGapGeneratedProse,
      claims(output) {
        return atomicGapGroundedClaims(
          normalizeGroundedGapModelResponseV7({
            value: output,
            policies: responsePolicies,
          }),
        );
      },
      allowConflictingClaim(output, claim) {
        return (
          output.findings[claim.queryUnitId]?.requiresReview === true ||
          Boolean(
            input.requirements
              .find((item) => item.requirement.code === claim.queryUnitId)
              ?.reviewCorrection?.resolutionReason?.trim(),
          )
        );
      },
    },
    idempotencyKey: input.idempotencyKey,
    assessmentRevisionId: input.assessmentRevisionId,
    jobId: input.jobId,
    abortSignal: input.abortSignal,
    promptMetadata: {
      name: GAP_PROMPT_V7_NAME,
      version: GAP_PROMPT_V7_VERSION,
      templateHash: GAP_PROMPT_V7_TEMPLATE_HASH,
      responseSchemaVersion: GAP_RESPONSE_SCHEMA_V7_VERSION,
    },
  });
  if (responsePolicies.length === 0) {
    responsePolicies = buildResponsePolicies(
      input.requirements,
      grounded.context,
      input.outputLocale,
    );
  }
  const findings = normalizeGroundedGapModelResponseV7({
    value: grounded.output,
    policies: responsePolicies,
  });
  for (const finding of findings) {
    await input.onAcceptedCategory?.(finding.requirementCode);
  }
  return {
    runId: grounded.runId,
    outputLocale: input.outputLocale,
    context: grounded.context,
    findings,
  };
}

async function generateAtomicGapCategoriesVersioned(
  input: Parameters<typeof generateAtomicGapBatch>[0],
  contractVersion: "8" | "9" | "10" | "11" | "12",
): Promise<{
  runId: string;
  outputLocale: Locale;
  context: GroundingContextItem[];
  findings: ValidatedCategoryGapResult[];
  runIdsByCategory: Record<string, string>;
}> {
  const signal = input.abortSignal ?? new AbortController().signal;
  const contextByCategory = new Map<string, GroundingContextItem[]>();
  const runIdsByCategory: Record<string, string> = {};
  const preparedGrounding = await prepareGroundingOperation({
    operation: "gap_analysis",
    organizationId: input.organizationId,
    workflowReleaseId: input.release.id,
  });
  const initialQueryUnits = new Map(
    input.requirements.map((item) => [
      item.requirement.code,
      gapV8QueryUnit(input, item, "initial"),
    ]),
  );
  const preparedEmbeddings = await prepareQueryEmbeddings(
    [...initialQueryUnits.values()],
    input.jobId,
    input.selectedDocumentVersionIds.length > 0,
  );
  const coordinated = await coordinateCategoryGeneration<
    AtomicGapRequirementInput,
    GapCategoryResponseV8,
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
        contract:
          contractVersion === "12"
            ? GAP_RESPONSE_SCHEMA_V12_VERSION
            : contractVersion === "11"
              ? GAP_RESPONSE_SCHEMA_V11_VERSION
            : contractVersion === "10"
              ? GAP_RESPONSE_SCHEMA_V10_VERSION
              : GAP_RESPONSE_SCHEMA_V8_VERSION,
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
      let responsePolicy: GapResponsePolicyV8 | GapResponsePolicyV9 | undefined;
      const queryUnit = phase === "initial"
        ? initialQueryUnits.get(item.requirement.code)!
        : gapV8QueryUnit(input, item, phase, rejectedCandidate);
      const legalQuery = resolveGroundingRetrievalQuery(queryUnit, "legal");
      const organizationQuery = resolveGroundingRetrievalQuery(
        queryUnit,
        "organization_document",
      );
      const grounded = await runGroundedOperation<GapCategoryResponseV8>({
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
        systemInstruction: gapVersionedInstruction({
          contractVersion,
          locale: input.outputLocale,
          categoryCode: item.requirement.code,
          semanticContexts: gapV9SemanticContexts(item, input.outputLocale),
          phase,
          issues: issues ?? [],
        }),
        outputContract: {
          schema(context) {
            if (contractVersion !== "8") {
              const policy = gapV9ResponsePolicy(
                item,
                context,
                input.outputLocale,
              );
              responsePolicy = policy;
              return contractVersion === "12"
                ? buildGapCategoryResponseSchemaV12(policy)
                : contractVersion === "11"
                  ? buildGapCategoryResponseSchemaV11(policy)
                : contractVersion === "10"
                  ? buildGapCategoryResponseSchemaV10(policy)
                  : buildGapCategoryResponseSchemaV9(policy);
            }
            const policy = gapV8ResponsePolicy(
              item,
              context,
              input.outputLocale,
            );
            responsePolicy = policy;
            return buildGapCategoryResponseSchemaV8(policy);
          },
          languagePolicy: "localized",
          generatedProse: gapV8GeneratedProse,
          claims(value) {
            const policy =
              responsePolicy ??
              (contractVersion !== "8"
                ? gapV9ResponsePolicy(
                    item,
                    contextByCategory.get(item.requirement.code) ?? [],
                    input.outputLocale,
                  )
                : gapV8ResponsePolicy(
                    item,
                    contextByCategory.get(item.requirement.code) ?? [],
                    input.outputLocale,
                  ));
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
        idempotencyKey: contentHash({
          taskId: task.taskId,
          phase,
          providerAttempt,
        }),
        assessmentRevisionId: input.assessmentRevisionId,
        jobId: input.jobId,
        abortSignal: taskSignal,
        promptMetadata: gapVersionedMetadata(contractVersion),
        precomputedQueryEmbeddings: phase === "initial"
          ? {
              legal: preparedEmbeddings.get(legalQuery),
              organizationDocument: preparedEmbeddings.get(organizationQuery),
            }
          : undefined,
        preparedGrounding,
      });
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
        const normalized =
          contractVersion === "12"
            ? normalizeGapCategoryResponseV12({
                value: candidate,
                policy: gapV9ResponsePolicy(
                  task.input,
                  contextByCategory.get(task.categoryCode) ?? [],
                  input.outputLocale,
                ),
              })
            : contractVersion === "11"
              ? normalizeGapCategoryResponseV11({
                  value: candidate,
                  policy: gapV9ResponsePolicy(
                    task.input,
                    contextByCategory.get(task.categoryCode) ?? [],
                    input.outputLocale,
                  ),
                })
              : contractVersion === "10"
              ? normalizeGapCategoryResponseV10({
                  value: candidate,
                  policy: gapV9ResponsePolicy(
                    task.input,
                    contextByCategory.get(task.categoryCode) ?? [],
                    input.outputLocale,
                  ),
                })
              : contractVersion === "9"
                ? normalizeGapCategoryResponseV9({
                    value: candidate,
                    policy: gapV9ResponsePolicy(
                      task.input,
                      contextByCategory.get(task.categoryCode) ?? [],
                      input.outputLocale,
                    ),
                  })
                : normalizeGapCategoryResponseV8({
                    value: candidate,
                    policy: gapV8ResponsePolicy(
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
) {
  const queries = [...new Set(queryUnits.flatMap((unit) => [
    resolveGroundingRetrievalQuery(unit, "legal"),
    ...(includeOrganizationDocuments
      ? [resolveGroundingRetrievalQuery(unit, "organization_document")]
      : []),
  ]))];
  const provider = createDocumentEmbeddingProvider();
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

function gapV8QueryUnit(
  input: Parameters<typeof generateAtomicGapBatch>[0],
  item: AtomicGapRequirementInput,
  phase: "initial" | "repair",
  rejectedCandidate?: GapCategoryResponseV8,
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

function gapV8ResponsePolicy(
  item: AtomicGapRequirementInput,
  context: GroundingContextItem[],
  outputLocale: Locale,
): GapResponsePolicyV8 {
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

function gapV9ResponsePolicy(
  item: AtomicGapRequirementInput,
  context: GroundingContextItem[],
  outputLocale: Locale,
): GapResponsePolicyV9 {
  return {
    ...gapV8ResponsePolicy(item, context, outputLocale),
    semanticContextByQuestion: Object.fromEntries(
      gapV9SemanticContexts(item, outputLocale).map((semantic) => [
        semantic.questionStableKey,
        semantic,
      ]),
    ),
  };
}

function gapV9SemanticContexts(
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

function gapV8GeneratedProse(value: GapCategoryResponseV8) {
  return [
    ...Object.values(value.gaps).flatMap((gaps) =>
      gaps.map((gap) => gap.statement),
    ),
    ...(value.reviewNotice ? [value.reviewNotice] : []),
    ...value.assumptions,
    ...value.contradictions,
  ];
}

function gapVersionedInstruction(input: {
  contractVersion: "8" | "9" | "10" | "11" | "12";
  locale: Locale;
  categoryCode: string;
  semanticContexts: ReturnType<typeof gapV9SemanticContexts>;
  phase: "initial" | "repair";
  issues: Parameters<typeof gapRepairPromptV10>[0]["issues"];
}) {
  if (input.contractVersion === "12") {
    return input.phase === "initial"
      ? gapPromptV12({
          locale: input.locale,
          semanticContexts: input.semanticContexts,
        })
      : gapRepairPromptV12({
          locale: input.locale,
          categoryCode: input.categoryCode,
          semanticContexts: input.semanticContexts,
          issues: input.issues,
        });
  }
  if (input.contractVersion === "11") {
    return input.phase === "initial"
      ? gapPromptV11({
          locale: input.locale,
          semanticContexts: input.semanticContexts,
        })
      : gapRepairPromptV11({
          locale: input.locale,
          categoryCode: input.categoryCode,
          semanticContexts: input.semanticContexts,
          issues: input.issues,
        });
  }
  if (input.contractVersion === "10") {
    return input.phase === "initial"
      ? gapPromptV10({
          locale: input.locale,
          semanticContexts: input.semanticContexts,
        })
      : gapRepairPromptV10({
          locale: input.locale,
          categoryCode: input.categoryCode,
          semanticContexts: input.semanticContexts,
          issues: input.issues,
        });
  }
  if (input.contractVersion === "9") {
    return input.phase === "initial"
      ? gapPromptV9({
          locale: input.locale,
          semanticContexts: input.semanticContexts,
        })
      : gapRepairPromptV9({
          locale: input.locale,
          categoryCode: input.categoryCode,
          semanticContexts: input.semanticContexts,
          issues: input.issues,
        });
  }
  return input.phase === "initial"
    ? gapPromptV8(input.locale)
    : gapRepairPromptV8({
        locale: input.locale,
        categoryCode: input.categoryCode,
        issues: input.issues,
      });
}

function gapVersionedMetadata(
  contractVersion: "8" | "9" | "10" | "11" | "12",
) {
  if (contractVersion === "12") {
    return {
      name: GAP_PROMPT_V12_NAME,
      version: GAP_PROMPT_V12_VERSION,
      templateHash: GAP_PROMPT_V12_TEMPLATE_HASH,
      responseSchemaVersion: GAP_RESPONSE_SCHEMA_V12_VERSION,
    };
  }
  if (contractVersion === "11") {
    return {
      name: GAP_PROMPT_V11_NAME,
      version: GAP_PROMPT_V11_VERSION,
      templateHash: GAP_PROMPT_V11_TEMPLATE_HASH,
      responseSchemaVersion: GAP_RESPONSE_SCHEMA_V11_VERSION,
    };
  }
  if (contractVersion === "10") {
    return {
      name: GAP_PROMPT_V10_NAME,
      version: GAP_PROMPT_V10_VERSION,
      templateHash: GAP_PROMPT_V10_TEMPLATE_HASH,
      responseSchemaVersion: GAP_RESPONSE_SCHEMA_V10_VERSION,
    };
  }
  if (contractVersion === "9") {
    return {
      name: GAP_PROMPT_V9_NAME,
      version: GAP_PROMPT_V9_VERSION,
      templateHash: GAP_PROMPT_V9_TEMPLATE_HASH,
      responseSchemaVersion: GAP_RESPONSE_SCHEMA_V9_VERSION,
    };
  }
  return {
    name: GAP_PROMPT_V8_NAME,
    version: GAP_PROMPT_V8_VERSION,
    templateHash: GAP_PROMPT_V8_TEMPLATE_HASH,
    responseSchemaVersion: GAP_RESPONSE_SCHEMA_V8_VERSION,
  };
}

export function extractAtomicGapGeneratedProse(
  value: GroundedGapModelResponseV7,
) {
  return Object.values(value.findings).flatMap((finding) => [
    ...Object.values(finding.gaps ?? {}).flatMap((gaps) =>
      gaps.map((gap) => gap.statement),
    ),
    ...(finding.reviewNotice ? [finding.reviewNotice] : []),
    ...finding.assumptions,
    ...finding.contradictions,
  ]);
}

function buildResponsePolicies(
  requirements: AtomicGapRequirementInput[],
  context: GroundingContextItem[],
  outputLocale: Locale,
) {
  return requirements.map((item) => {
    const supplied = context.filter(
      (contextItem) => contextItem.queryUnitId === item.requirement.code,
    );
    const base = provisionalResponsePolicy(item, outputLocale);
    return {
      ...base,
      permittedCitationIds: supplied.map(
        (contextItem) => contextItem.citationId,
      ),
      questionnaireCitationIdsByQuestion: Object.fromEntries(
        item.policy.triggeringQuestions.map((trigger) => {
          const answerId =
            item.sourceAssessmentAnswerIdByQuestion[trigger.stableKey];
          const assertion = supplied.find(
            (contextItem) =>
              contextItem.channel === "questionnaire_assertion" &&
              contextItem.sourceId === answerId,
          );
          if (!assertion) {
            throw new Error(
              `Questionnaire citation is missing for ${trigger.stableKey}`,
            );
          }
          return [trigger.stableKey, assertion.citationId];
        }),
      ),
      admittedOrganizationCitationIds: supplied
        .filter(
          (contextItem) => contextItem.channel === "organization_document",
        )
        .map((contextItem) => contextItem.citationId),
      preferredPrimaryLegalCitationIds: supplied
        .filter(
          (contextItem) =>
            contextItem.channel === "legal" &&
            contextItem.metadata.selectionRole === "mapped_primary",
        )
        .map((contextItem) => contextItem.citationId),
    };
  });
}

function provisionalResponsePolicy(
  item: AtomicGapRequirementInput,
  outputLocale: Locale,
): GapResponsePolicyV7 {
  const allNotApplicable = item.policy.triggeringQuestions.every(
    (question) => question.stableValue === "not_applicable",
  );
  return {
    requirementCode: item.requirement.code,
    outputLocale,
    status: item.determinedStatus,
    statementBasis: {
      version: "1",
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
