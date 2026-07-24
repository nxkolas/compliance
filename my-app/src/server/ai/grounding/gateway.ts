import { createHash } from "node:crypto";
import type { AiProviderMode } from "@/lib/ai/types";
import { db } from "@/src/db";
import { aiProcessingRunContext, aiProcessingRuns } from "@/src/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { ApiError } from "../../api/errors";
import { buildGroundedPrompt } from "./context-builder";
import { retrievePinnedLegalContext } from "./legal-retrieval";
import { retrieveOrganizationContext } from "./organization-retrieval";
import { resolveGroundingPolicy } from "./policy";
import { selectGroundedProvider } from "./provider-policy";
import { createAiSdkGroundedProvider } from "./providers/ai-sdk";
import { persistGroundingProvenance } from "./provenance";
import type { GroundedOutputContract, GroundedProvider, GroundingContextItem, QueryUnit } from "./types";
import { hasCompleteQueryUnitCoverage, validateGroundedClaims } from "./validation";
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
} from "../../gap-analysis/grounding-instruction";

export async function runGroundedOperation<T>(input: {
  operation: "gap_analysis";
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
  outputContract: GroundedOutputContract<T>;
  idempotencyKey: string;
  assessmentRevisionId?: string;
  jobId?: string;
}, dependencies: {
  providers?: Partial<Record<AiProviderMode, GroundedProvider>>;
  languageDetector?: LanguageDetector;
} = {}) {
  const existing = await db.query.aiProcessingRuns.findFirst({
    where: and(
      eq(aiProcessingRuns.organizationId, input.organizationId),
      eq(aiProcessingRuns.operationKind, "gap_analysis"),
      eq(aiProcessingRuns.idempotencyKey, input.idempotencyKey),
    ),
  });
  if (existing) {
    assertOutputLocaleMatches(
      existing.outputLocale,
      input.outputLocale,
      { runId: existing.id },
    );
  }
  if (existing?.status === "processing" && existing.validatedOutput !== null) {
    const output = input.outputContract.schema.parse(existing.validatedOutput);
    const rows = await db.query.aiProcessingRunContext.findMany({
      where: eq(aiProcessingRunContext.runId, existing.id),
      orderBy: [asc(aiProcessingRunContext.promptPosition)],
    });
    const context = rows.map((row): GroundingContextItem => {
      const sourceId = row.legalChunkId ?? row.documentChunkId ?? row.assessmentAnswerId;
      if (!sourceId) throw new ApiError(409, "Grounding recovery context is incomplete", undefined, "GROUNDING_RECOVERY_INCOMPLETE");
      return {
        channel: row.channel,
        citationId: row.citationId,
        queryUnitId: row.queryUnitId,
        sourceId,
        excerpt: row.excerptSnapshot,
        excerptHash: row.excerptHash,
        rank: row.retrievalRank,
        score: Number(row.retrievalScore),
        metadata: { queryHash: row.queryHash, recovered: true },
      };
    });
    return {
      runId: existing.id,
      output,
      outputLocale: existing.outputLocale,
      context,
      claims: [],
      recovered: true,
    };
  }
  if (existing) throw new ApiError(409, "Grounded operation already exists", { runId: existing.id }, "GROUNDING_RUN_EXISTS");
  const policy = await resolveGroundingPolicy({ operation: input.operation, organizationId: input.organizationId });
  const providers = dependencies.providers ?? configuredProviders();
  const provider = selectGroundedProvider({
    allowedModes: policy.providerPolicy.allowedProviderModes,
    externalDisclosureAllowed: policy.providerPolicy.externalDisclosureAllowed,
    providers,
    preferredMode: process.env.AI_DEFAULT_PROVIDER,
  });
  const retrievedContext = (await Promise.all(input.queryUnits.map(async (unit) => {
    const legal = await retrievePinnedLegalContext({
      workflowKind: policy.workflowKind,
      workflowReleaseId: input.workflowReleaseId,
      familyCodes: policy.familyCodes,
      frameworkCode: policy.frameworkCode,
      jurisdictionCodes: policy.jurisdictionCodes,
      asOfDate: input.asOfDate,
      language: "de",
      queryUnitId: unit.id,
      query: unit.query,
    });
    const organization = input.organizationEvidenceVersionIds.length
      ? await retrieveOrganizationContext({
          userId: input.actor.userId,
          organizationId: input.organizationId,
          documentVersionIds: input.organizationEvidenceVersionIds,
          queryUnitId: unit.id,
          query: unit.query,
        })
      : [];
    return [...legal, ...organization];
  }))).flat();
  const queryIds = new Set(input.queryUnits.map((unit) => unit.id));
  const assertions: GroundingContextItem[] = (input.questionnaireAssertions ?? []).map((assertion, index) => {
    if (!queryIds.has(assertion.queryUnitId)) {
      throw new ApiError(400, "Questionnaire assertion query unit is invalid", undefined, "GROUNDING_ASSERTION_INVALID");
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
        queryHash: createHash("sha256").update(input.queryUnits.find((unit) => unit.id === assertion.queryUnitId)!.query).digest("hex"),
      },
    };
  });
  const context = [...retrievedContext, ...assertions];
  const prompt = buildGroundedPrompt(input.queryUnits, context);
  if (input.operation === "gap_analysis") {
    prompt.system += ` ${GAP_GROUNDING_INSTRUCTION} ${gapOutputLocaleInstruction(input.outputLocale)}`;
  }
  const promptHash = createHash("sha256").update(`${prompt.system}\n${prompt.prompt}`).digest("hex");
  const corpusReleaseSetHash = createHash("sha256").update(context.filter((item) => item.channel === "legal").map((item) => item.metadata.corpusReleaseId).sort().join("\n")).digest("hex");
  const [run] = await db.insert(aiProcessingRuns).values({
    organizationId: input.organizationId,
    assessmentRevisionId: input.assessmentRevisionId,
    operationKind: "gap_analysis",
    status: "processing",
    outputLocale: input.outputLocale,
    attemptCount: 0,
    languageValidation: initialLanguageValidation(
      input.outputLocale,
      dependencies.languageDetector ?? localAggregateLanguageDetector,
    ),
    inputHash: createHash("sha256").update(JSON.stringify(input.queryUnits)).digest("hex"),
    idempotencyKey: input.idempotencyKey,
    provider: provider.provider,
    model: provider.model,
    promptName: "grounded-gap-analysis",
    promptVersion: "v4",
    promptTemplateHash: promptHash,
    renderedInputHash: promptHash,
    responseSchemaVersion: "grounding-v4",
    providerPolicyVersion: policy.providerPolicy.version,
    corpusReleaseSetHash,
    provenanceStatus: "complete",
    jobId: input.jobId,
    createdBy: input.actor.userId,
    startedAt: new Date(),
  }).returning();
  try {
    const result =
      input.outputContract.languagePolicy === "localized"
        ? await executeLanguageValidatedProvider({
            provider,
            prompt,
            schema: input.outputContract.schema,
            expectedLocale: input.outputLocale,
            generatedProse: input.outputContract.generatedProse,
            detector:
              dependencies.languageDetector ??
              localAggregateLanguageDetector,
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
            schema: input.outputContract.schema,
            outputLocale: input.outputLocale,
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
      throw new ApiError(422, "Grounded output omitted a query unit", undefined, "GROUNDING_COVERAGE_INCOMPLETE");
    }
    const invalid = claims.filter((claim) =>
      claim.validation !== "supported"
      && !(claim.validation === "conflicting" && input.outputContract.allowConflictingClaim?.(parsed, claim)),
    );
    if (invalid.length) throw new ApiError(422, "Grounded output contains unsupported claims", { claims: invalid.map((claim) => claim.key) }, "GROUNDING_VALIDATION_FAILED");
    await persistGroundingProvenance({
      runId: run.id,
      context,
      claims,
      disclosedExternally: provider.mode === "openai",
    });
    await db.update(aiProcessingRuns).set({
      validatedOutput: parsed,
    }).where(eq(aiProcessingRuns.id, run.id));
    return {
      runId: run.id,
      output: parsed,
      outputLocale: input.outputLocale,
      context,
      claims,
    };
  } catch (error) {
    await db.update(aiProcessingRuns).set({
      status: "failed",
      errorCode: error instanceof ApiError ? error.code : "GROUNDING_FAILED",
      errorMessage: "Grounded operation failed.",
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
    }).where(eq(aiProcessingRuns.id, run.id));
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
  schema: GroundedOutputContract<T>["schema"];
  outputLocale: "de" | "en";
}) {
  const result = await input.provider.run({
    ...input.prompt,
    schema: input.schema,
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
