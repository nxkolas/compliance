import { createHash } from "node:crypto";
import type * as z from "zod";
import type { AiProviderMode } from "@/lib/ai/types";
import { db } from "@/src/db";
import { aiProcessingRuns } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../../api/errors";
import { buildGroundedPrompt } from "./context-builder";
import { retrievePinnedLegalContext } from "./legal-retrieval";
import { retrieveOrganizationContext } from "./organization-retrieval";
import { resolveGroundingPolicy } from "./policy";
import { selectGroundedProvider } from "./provider-policy";
import { createAiSdkGroundedProvider } from "./providers/ai-sdk";
import { persistGroundingProvenance } from "./provenance";
import {
  resolveGroundingRetrievalQuery,
  type GroundedOutputContract,
  type GroundedProvider,
  type GroundingContextItem,
  type QueryUnit,
} from "./types";
import {
  hasCompleteQueryUnitCoverage,
  safeGroundingFailureMessage,
  toGroundingFailureDiagnostic,
  validateGroundedClaims,
} from "./validation";
import {
  localAggregateLanguageDetector,
  type LanguageDetector,
} from "./language-detector";
import {
  assertOutputLocaleMatches,
  executeLanguageValidatedProvider,
  LanguagePolicyError,
  type LanguageValidationDiagnostic,
} from "./language-policy";
import {
  GAP_GROUNDING_INSTRUCTION,
  gapOutputLocaleInstruction,
} from "@/src/server/gap-analysis";
import { createAiProcessingRunWithLiveJobGate } from "../generation/job-run-lifecycle";

export async function runGroundedOperation<T>(
  input: {
    operation: "gap_analysis";
    runOperationKind?:
      "gap_analysis" | "gap_guidance_regeneration" | "action_plan_generation";
    actor: { userId: string };
    organizationId: string;
    outputLocale: "de" | "en";
    workflowReleaseId: string;
    asOfDate: string;
    organizationEvidenceVersionIds: string[];
    questionnaireAssertions?: Array<{
      answerId: string;
      queryUnitId: string;
      excerpt: string;
    }>;
    queryUnits: QueryUnit[];
    systemInstruction?: string;
    outputContract: GroundedOutputContract<T>;
    idempotencyKey: string;
    assessmentRevisionId?: string;
    jobId?: string;
    promptMetadata?: {
      name: string;
      version: string;
      templateHash: string;
      responseSchemaVersion: string;
    };
    abortSignal?: AbortSignal;
  },
  dependencies: {
    providers?: Partial<Record<AiProviderMode, GroundedProvider>>;
    languageDetector?: LanguageDetector;
  } = {},
) {
  const existing = await db.query.aiProcessingRuns.findFirst({
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
          eq(table.operationKind, input.runOperationKind ?? "gap_analysis"),
          eq(table.idempotencyKey, input.idempotencyKey),
        ) ?? operators.sql`true`,
    },
  });
  if (existing) {
    assertOutputLocaleMatches(existing.outputLocale, input.outputLocale, {
      runId: existing.id,
    });
  }
  if (existing?.status === "processing" && existing.validatedOutput !== null) {
    const rows = await db.query.aiProcessingRunContext.findMany({
      columns: {
        id: true,
        runId: true,
        channel: true,
        citationId: true,
        queryUnitId: true,
        queryHash: true,
        retrievalRank: true,
        retrievalScore: true,
        retrievalPolicyVersion: true,
        lexicalScore: true,
        semanticScore: true,
        combinedScore: true,
        selectionRole: true,
        preferredMappedProvision: true,
        mappedLegalProvisionId: true,
        retrievalDiagnostics: true,
        legalChunkId: true,
        documentChunkId: true,
        assessmentAnswerId: true,
        excerptHash: true,
        excerptSnapshot: true,
        disclosedExternally: true,
        promptPosition: true,
        createdAt: true,
      },
      where: {
        RAW: (table, operators) =>
          eq(table.runId, existing.id) ?? operators.sql`true`,
      },
      orderBy: { promptPosition: "asc" },
    });
    const context = rows.map((row): GroundingContextItem => {
      const sourceId =
        row.legalChunkId ?? row.documentChunkId ?? row.assessmentAnswerId;
      if (!sourceId)
        throw new ApiError(
          409,
          "Grounding recovery context is incomplete",
          undefined,
          "GROUNDING_RECOVERY_INCOMPLETE",
        );
      return {
        channel: row.channel,
        citationId: row.citationId,
        queryUnitId: row.queryUnitId,
        sourceId,
        excerpt: row.excerptSnapshot,
        excerptHash: row.excerptHash,
        rank: row.retrievalRank,
        score: Number(row.retrievalScore),
        metadata: {
          queryHash: row.queryHash,
          recovered: true,
          retrievalPolicyVersion: row.retrievalPolicyVersion,
          lexicalScore:
            row.lexicalScore === null ? undefined : Number(row.lexicalScore),
          semanticScore:
            row.semanticScore === null ? undefined : Number(row.semanticScore),
          combinedScore:
            row.combinedScore === null ? undefined : Number(row.combinedScore),
          selectionRole: row.selectionRole,
          preferredMappedProvision: row.preferredMappedProvision,
          legalProvisionId: row.mappedLegalProvisionId,
          retrievalDiagnostics: row.retrievalDiagnostics,
        },
      };
    });
    const output = input.outputContract
      .schema(context)
      .parse(existing.validatedOutput);
    return {
      runId: existing.id,
      output,
      outputLocale: existing.outputLocale,
      context,
      claims: [],
      recovered: true,
    };
  }
  if (existing)
    throw new ApiError(
      409,
      "Grounded operation already exists",
      { runId: existing.id },
      "GROUNDING_RUN_EXISTS",
    );
  const policy = await resolveGroundingPolicy({
    operation: input.operation,
    organizationId: input.organizationId,
  });
  const providers = dependencies.providers ?? configuredProviders();
  const provider = selectGroundedProvider({
    allowedModes: policy.providerPolicy.allowedProviderModes,
    externalDisclosureAllowed: policy.providerPolicy.externalDisclosureAllowed,
    providers,
    preferredMode: process.env.AI_DEFAULT_PROVIDER,
  });
  const retrievedContext = (
    await Promise.all(
      input.queryUnits.map(async (unit) => {
        const legalRetrievalQuery = resolveGroundingRetrievalQuery(
          unit,
          "legal",
        );
        const organizationRetrievalQuery = resolveGroundingRetrievalQuery(
          unit,
          "organization_document",
        );
        const legal = await retrievePinnedLegalContext({
          workflowKind: policy.workflowKind,
          workflowReleaseId: input.workflowReleaseId,
          familyCodes: policy.familyCodes,
          frameworkCode: policy.frameworkCode,
          jurisdictionCodes: policy.jurisdictionCodes,
          asOfDate: input.asOfDate,
          language: "de",
          queryUnitId: unit.id,
          query: legalRetrievalQuery,
          preferredMappedLegalProvisionIds:
            unit.preferredMappedLegalProvisionIds,
          preferredMappedLegalProvisionKeys:
            unit.preferredMappedLegalProvisionKeys,
          tierLimits: unit.legalTierLimits,
        });
        const organization = input.organizationEvidenceVersionIds.length
          ? await retrieveOrganizationContext({
              userId: input.actor.userId,
              organizationId: input.organizationId,
              documentVersionIds: input.organizationEvidenceVersionIds,
              queryUnitId: unit.id,
              query: organizationRetrievalQuery,
            })
          : [];
        return [...legal, ...organization];
      }),
    )
  ).flat();
  const queryIds = new Set(input.queryUnits.map((unit) => unit.id));
  const assertions: GroundingContextItem[] = (
    input.questionnaireAssertions ?? []
  ).map((assertion, index) => {
    if (!queryIds.has(assertion.queryUnitId)) {
      throw new ApiError(
        400,
        "Questionnaire assertion query unit is invalid",
        undefined,
        "GROUNDING_ASSERTION_INVALID",
      );
    }
    return {
      channel: "questionnaire_assertion" as const,
      citationId: `Q:${assertion.queryUnitId}:${assertion.answerId}`,
      queryUnitId: assertion.queryUnitId,
      sourceId: assertion.answerId,
      excerpt: assertion.excerpt,
      excerptHash: createHash("sha256").update(assertion.excerpt).digest("hex"),
      rank: index + 1,
      score: 1,
      metadata: {
        queryHash: createHash("sha256")
          .update(
            input.queryUnits.find((unit) => unit.id === assertion.queryUnitId)!
              .query,
          )
          .digest("hex"),
        selectionRole: "questionnaire_assertion",
      },
    };
  });
  const context = [...retrievedContext, ...assertions];
  const outputSchema = input.outputContract.schema(context);
  const prompt = buildGroundedPrompt(input.queryUnits, context);
  if (input.operation === "gap_analysis") {
    prompt.system += ` ${GAP_GROUNDING_INSTRUCTION} ${gapOutputLocaleInstruction(input.outputLocale)}`;
  }
  if (input.systemInstruction) {
    prompt.system += ` ${input.systemInstruction}`;
  }
  const promptHash = createHash("sha256")
    .update(`${prompt.system}\n${prompt.prompt}`)
    .digest("hex");
  const corpusReleaseSetHash = createHash("sha256")
    .update(
      context
        .filter((item) => item.channel === "legal")
        .map((item) => item.metadata.corpusReleaseId)
        .sort()
        .join("\n"),
    )
    .digest("hex");
  const run = await createAiProcessingRunWithLiveJobGate({
    organizationId: input.organizationId,
    assessmentRevisionId: input.assessmentRevisionId,
    operationKind: input.runOperationKind ?? "gap_analysis",
    status: "processing",
    outputLocale: input.outputLocale,
    attemptCount: 0,
    languageValidation: initialLanguageValidation(
      input.outputLocale,
      dependencies.languageDetector ?? localAggregateLanguageDetector,
    ),
    inputHash: createHash("sha256")
      .update(JSON.stringify(input.queryUnits))
      .digest("hex"),
    idempotencyKey: input.idempotencyKey,
    provider: provider.provider,
    model: provider.model,
    promptName: input.promptMetadata?.name ?? "grounded-gap-analysis",
    promptVersion: input.promptMetadata?.version ?? "v4",
    promptTemplateHash: input.promptMetadata?.templateHash ?? promptHash,
    renderedInputHash: promptHash,
    responseSchemaVersion:
      input.promptMetadata?.responseSchemaVersion ?? "grounding-v4",
    providerPolicyVersion: policy.providerPolicy.version,
    corpusReleaseSetHash,
    provenanceStatus: "complete",
    jobId: input.jobId,
    createdBy: input.actor.userId,
    startedAt: new Date(),
  });
  try {
    const result =
      input.outputContract.languagePolicy === "localized"
        ? await executeLanguageValidatedProvider({
            provider,
            prompt,
            schema: outputSchema,
            expectedLocale: input.outputLocale,
            generatedProse: input.outputContract.generatedProse,
            detector:
              dependencies.languageDetector ?? localAggregateLanguageDetector,
            abortSignal: input.abortSignal,
            async onProviderAttempt(progress) {
              await db
                .update(aiProcessingRuns)
                .set({
                  attemptCount: progress.attemptCount,
                  inputTokens: progress.usage.inputTokens,
                  outputTokens: progress.usage.outputTokens,
                  cachedInputTokens: progress.usage.cachedInputTokens,
                })
                .where(eq(aiProcessingRuns.id, run.id));
            },
          })
        : await runLanguageNeutralProvider({
            provider,
            prompt,
            schema: outputSchema,
            outputLocale: input.outputLocale,
            abortSignal: input.abortSignal,
          });
    const parsed = result.output;
    await db
      .update(aiProcessingRuns)
      .set({
        attemptCount: result.attemptCount,
        languageValidation: result.languageValidation,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cachedInputTokens: result.usage.cachedInputTokens,
      })
      .where(eq(aiProcessingRuns.id, run.id));
    const claims = validateGroundedClaims({
      queryUnits: input.queryUnits,
      context,
      claims: input.outputContract.claims(parsed),
    });
    if (!hasCompleteQueryUnitCoverage(input.queryUnits, claims)) {
      throw new ApiError(
        422,
        "Grounded output omitted a query unit",
        undefined,
        "GROUNDING_COVERAGE_INCOMPLETE",
      );
    }
    const invalid = claims.filter(
      (claim) =>
        claim.validation !== "supported" &&
        !(
          claim.validation === "conflicting" &&
          input.outputContract.allowConflictingClaim?.(parsed, claim)
        ),
    );
    if (invalid.length) {
      throw new ApiError(
        422,
        "Grounded output contains unsupported claims",
        toGroundingFailureDiagnostic(invalid),
        "GROUNDING_VALIDATION_FAILED",
      );
    }
    await persistGroundingProvenance({
      runId: run.id,
      context,
      claims,
      disclosedExternally: provider.mode === "openai",
    });
    await db
      .update(aiProcessingRuns)
      .set({
        validatedOutput: parsed,
      })
      .where(eq(aiProcessingRuns.id, run.id));
    return {
      runId: run.id,
      output: parsed,
      outputLocale: input.outputLocale,
      context,
      claims,
    };
  } catch (error) {
    await db
      .update(aiProcessingRuns)
      .set({
        status: "failed",
        errorCode:
          error instanceof ApiError
            ? error.code
            : error instanceof Error && error.name === "AbortError"
              ? "GENERATION_CANCELLED"
              : "GROUNDING_FAILED",
        errorMessage: safeGroundingFailureMessage(error),
        ...(error instanceof LanguagePolicyError
          ? {
              attemptCount: error.attemptCount,
              languageValidation: error.languageValidation,
              inputTokens: error.usage.inputTokens,
              outputTokens: error.usage.outputTokens,
              cachedInputTokens: error.usage.cachedInputTokens,
            }
          : {}),
        completedAt: new Date(),
      })
      .where(eq(aiProcessingRuns.id, run.id));
    throw error;
  }
}

function initialLanguageValidation(
  outputLocale: "de" | "en",
  detector: LanguageDetector,
): LanguageValidationDiagnostic {
  return {
    version: 1,
    detector: {
      implementation: detector.implementation,
      version: detector.version,
    },
    expectedLocale: outputLocale,
    attempts: [],
  };
}

async function runLanguageNeutralProvider<T>(input: {
  provider: GroundedProvider;
  prompt: { system: string; prompt: string };
  schema: z.ZodType<T>;
  outputLocale: "de" | "en";
  abortSignal?: AbortSignal;
}) {
  const result = await input.provider.run({
    ...input.prompt,
    schema: input.schema,
    abortSignal: input.abortSignal,
  });
  return {
    output: input.schema.parse(result.output),
    attemptCount: 1,
    languageValidation: {
      version: 1 as const,
      detector: { implementation: "not_applicable", version: "1" },
      expectedLocale: input.outputLocale,
      attempts: [],
    },
    usage: result.usage,
  };
}

function configuredProviders() {
  const providers: Partial<Record<AiProviderMode, GroundedProvider>> = {};
  for (const mode of ["company_hosted", "self_hosted", "openai"] as const) {
    try {
      providers[mode] = createAiSdkGroundedProvider(mode);
    } catch {
      // Missing provider configuration remains unavailable; policy fails closed.
    }
  }
  return providers;
}
