import { createHash } from "node:crypto";
import type * as z from "zod";
import type { AiProviderMode } from "@/lib/ai/types";
import { db } from "@/src/db";
import { aiProcessingRunContext, aiProcessingRuns } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../../api/errors";
import {
  GAP_GROUNDING_INSTRUCTION,
  gapOutputLocaleInstruction,
} from "@/src/server/gap-analysis/grounding-instruction";
import { buildGroundedPrompt } from "./context-builder";
import {
  resolvePinnedLegalScope,
  retrievePinnedLegalContext,
  type PinnedLegalSnapshot,
} from "./legal-retrieval";
import { retrieveOrganizationContext } from "./organization-retrieval";
import { resolveGroundingPolicy } from "./policy";
import { selectGroundedProvider } from "./provider-policy";
import { createAiSdkGroundedProvider } from "./providers/ai-sdk";
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
  executeLanguageValidatedProvider,
} from "./language-policy";
import {
  localAggregateLanguageDetector,
  type LanguageDetector,
} from "./language-detector";
import { withProviderPermit } from "./provider-limiter";
import { createAiProcessingRunWithLiveJobGate } from "../generation/job-run-lifecycle";

export type PreparedGroundingOperation = {
  policy: Awaited<ReturnType<typeof resolveGroundingPolicy>>;
  provider: GroundedProvider;
  pinnedSnapshots: PinnedLegalSnapshot[];
};

export async function prepareGroundingOperation(
  input: {
    operation: "gap_analysis";
    organizationId: string;
    workflowReleaseId: string;
  },
  dependencies: {
    providers?: Partial<Record<AiProviderMode, GroundedProvider>>;
  } = {},
): Promise<PreparedGroundingOperation> {
  const policy = await resolveGroundingPolicy({
    operation: input.operation,
    organizationId: input.organizationId,
  });
  const provider = selectGroundedProvider({
    selectedMode: policy.providerPolicy.selectedProviderMode,
    providers: dependencies.providers ?? configuredProviders(),
  });
  const pinnedSnapshots = await resolvePinnedLegalScope({
    familyCodes: policy.familyCodes,
  });
  return { policy, provider, pinnedSnapshots };
}

export async function runGroundedOperation<T>(
  input: {
    operation: "gap_analysis";
    runOperationKind?:
      | "gap_analysis"
      | "gap_conflict_resolution"
      | "action_plan_generation";
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
    precomputedQueryEmbeddings?: {
      legal?: number[];
      organizationDocument?: number[];
    };
    preparedGrounding?: PreparedGroundingOperation;
  },
  dependencies: {
    providers?: Partial<Record<AiProviderMode, GroundedProvider>>;
    languageDetector?: LanguageDetector;
  } = {},
) {
  const operationKind = input.runOperationKind ?? "gap_analysis";
  const existing = await db.query.aiProcessingRuns.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, input.organizationId),
          eq(table.operationKind, operationKind),
          eq(table.idempotencyKey, input.idempotencyKey),
        ) ?? operators.sql`true`,
    },
  });
  if (existing?.status === "succeeded") {
    throw new ApiError(
      409,
      "This grounded result was already published",
      { runId: existing.id },
      "GROUNDING_RUN_ALREADY_PUBLISHED",
    );
  }
  if (existing?.status === "processing" && existing.validatedOutput !== null) {
    const persisted = await db.query.aiProcessingRunContext.findMany({
      where: {
        RAW: (table, operators) =>
          eq(table.runId, existing.id) ?? operators.sql`true`,
      },
      orderBy: { position: "asc" },
    });
    const context = [
      ...persisted.map(fromPersistedContext),
      ...questionnaireContext(input.queryUnits, input.questionnaireAssertions),
    ];
    return {
      runId: existing.id,
      output: input.outputContract.schema(context).parse(existing.validatedOutput),
      outputLocale: existing.outputLocale,
      context,
      claims: [],
      recovered: true,
      pinnedSnapshots: snapshotPinsFromManifest(existing.inputManifest),
    };
  }
  if (existing) {
    throw new ApiError(
      409,
      "Grounded operation already exists",
      { runId: existing.id },
      "GROUNDING_RUN_EXISTS",
    );
  }

  const prepared =
    input.preparedGrounding ??
    (await prepareGroundingOperation(
      {
        operation: input.operation,
        organizationId: input.organizationId,
        workflowReleaseId: input.workflowReleaseId,
      },
      dependencies,
    ));
  const provider = withProviderPermit(prepared.provider, {
    jobId: input.jobId,
    categoryCode:
      input.queryUnits.length === 1 ? input.queryUnits[0]?.id : undefined,
  });
  const retrieved = (
    await Promise.all(
      input.queryUnits.map(async (unit) => {
        const [legal, organization] = await Promise.all([
          retrievePinnedLegalContext(
            {
              queryUnitId: unit.id,
              query: resolveGroundingRetrievalQuery(unit, "legal"),
              asOfDate: input.asOfDate,
              language: input.outputLocale,
              preferredMappedLegalProvisionKeys:
                unit.preferredMappedLegalProvisionKeys,
              tierLimits: unit.legalTierLimits,
              pinnedSnapshots: prepared.pinnedSnapshots,
            },
            { queryEmbedding: input.precomputedQueryEmbeddings?.legal },
          ),
          input.organizationEvidenceVersionIds.length
            ? retrieveOrganizationContext({
                userId: input.actor.userId,
                organizationId: input.organizationId,
                documentVersionIds: input.organizationEvidenceVersionIds,
                queryUnitId: unit.id,
                query: resolveGroundingRetrievalQuery(
                  unit,
                  "organization_document",
                ),
                queryEmbedding:
                  input.precomputedQueryEmbeddings?.organizationDocument,
              })
            : Promise.resolve([] as GroundingContextItem[]),
        ]);
        return [...legal, ...organization];
      }),
    )
  ).flat();
  const context = [
    ...retrieved,
    ...questionnaireContext(input.queryUnits, input.questionnaireAssertions),
  ];
  const schema = input.outputContract.schema(context);
  const prompt = buildGroundedPrompt(input.queryUnits, context);
  prompt.system += ` ${GAP_GROUNDING_INSTRUCTION} ${gapOutputLocaleInstruction(input.outputLocale)}`;
  if (input.systemInstruction) prompt.system += ` ${input.systemInstruction}`;
  const renderedInputHash = createHash("sha256")
    .update(`${prompt.system}\n${prompt.prompt}`)
    .digest("hex");
  const manifest = {
    version: 1,
    assessmentRevisionId: input.assessmentRevisionId ?? null,
    queryUnits: input.queryUnits,
    organizationEvidenceVersionIds: input.organizationEvidenceVersionIds,
    pinnedSnapshots: prepared.pinnedSnapshots,
    renderedInputHash,
  };
  const run = await createAiProcessingRunWithLiveJobGate({
      organizationId: input.organizationId,
      jobId: input.jobId,
      idempotencyKey: input.idempotencyKey,
      operationKind,
      status: "processing",
      provider: provider.provider,
      model: provider.model,
      promptName: input.promptMetadata?.name ?? "grounded-generation",
      promptVersion: input.promptMetadata?.version ?? "1",
      promptHash: input.promptMetadata?.templateHash ?? renderedInputHash,
      definitionHash: input.workflowReleaseId,
      buildHash: process.env.APP_BUILD_SHA ?? input.workflowReleaseId,
      inputManifest: manifest,
      claimValidation: { version: 1, status: "pending" },
      outputLocale: input.outputLocale,
      startedAt: new Date(),
    });

  try {
    const result =
      input.outputContract.languagePolicy === "localized"
        ? await executeLanguageValidatedProvider({
            provider,
            prompt,
            schema,
            expectedLocale: input.outputLocale,
            generatedProse: input.outputContract.generatedProse,
            detector:
              dependencies.languageDetector ?? localAggregateLanguageDetector,
            abortSignal: input.abortSignal,
          })
        : await runLanguageNeutralProvider({
            provider,
            prompt,
            schema,
            abortSignal: input.abortSignal,
          });
    const claims = validateGroundedClaims({
      queryUnits: input.queryUnits,
      context,
      claims: input.outputContract.claims(result.output),
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
          input.outputContract.allowConflictingClaim?.(result.output, claim)
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
    await db.transaction(async (tx) => {
      const persistable = context.filter(
        (item) => item.channel !== "questionnaire_assertion",
      );
      if (persistable.length) {
        await tx.insert(aiProcessingRunContext).values(
          persistable.map((item, position) => ({
            organizationId: input.organizationId,
            runId: run.id,
            channel:
              item.channel === "legal"
                ? ("legal_authority" as const)
                : ("organization_evidence" as const),
            documentChunkId:
              item.channel === "organization_document" ? item.sourceId : null,
            legalSourceChunkId:
              item.channel === "legal" ? item.sourceId : null,
            contextRole:
              typeof item.metadata.selectionRole === "string"
                ? item.metadata.selectionRole
                : "admitted",
            exactText: item.excerpt,
            vectorScore: numericScore(item.metadata.semanticScore),
            keywordScore: numericScore(item.metadata.lexicalScore),
            fusedScore: numericScore(item.metadata.combinedScore ?? item.score),
            metadata: {
              ...item.metadata,
              citationId: item.citationId,
              queryUnitId: item.queryUnitId,
              excerptHash: item.excerptHash,
              rank: item.rank,
              authorityTier: item.authorityTier,
              translationStatus: item.translationStatus,
            },
            position,
          })),
        );
      }
      await tx
        .update(aiProcessingRuns)
        .set({
          attemptCount: result.attemptCount,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cachedInputTokens: result.usage.cachedInputTokens,
          claimValidation: { version: 1, status: "validated", claims },
          validatedOutput: result.output,
        })
        .where(
          and(
            eq(aiProcessingRuns.id, run.id),
            eq(aiProcessingRuns.status, "processing"),
          ),
        );
    });
    return {
      runId: run.id,
      output: result.output,
      outputLocale: input.outputLocale,
      context,
      claims,
      pinnedSnapshots: prepared.pinnedSnapshots,
    };
  } catch (error) {
    await db
      .update(aiProcessingRuns)
      .set({
        status: "failed",
        failureCode:
          error instanceof ApiError
            ? error.code
            : error instanceof Error && error.name === "AbortError"
              ? "GENERATION_CANCELLED"
              : "GROUNDING_FAILED",
        failureMessage: safeGroundingFailureMessage(error),
        completedAt: new Date(),
      })
      .where(eq(aiProcessingRuns.id, run.id));
    throw error;
  }
}

function questionnaireContext(
  queryUnits: QueryUnit[],
  assertions: Array<{
    answerId: string;
    queryUnitId: string;
    excerpt: string;
  }> = [],
): GroundingContextItem[] {
  const queryById = new Map(queryUnits.map((unit) => [unit.id, unit.query]));
  return assertions.map((assertion, index) => {
    const query = queryById.get(assertion.queryUnitId);
    if (!query) {
      throw new ApiError(
        400,
        "Questionnaire assertion query unit is invalid",
        undefined,
        "GROUNDING_ASSERTION_INVALID",
      );
    }
    return {
      channel: "questionnaire_assertion",
      citationId: `Q:${assertion.queryUnitId}:${assertion.answerId}`,
      queryUnitId: assertion.queryUnitId,
      sourceId: assertion.answerId,
      excerpt: assertion.excerpt,
      excerptHash: createHash("sha256").update(assertion.excerpt).digest("hex"),
      rank: index + 1,
      score: 1,
      metadata: {
        queryHash: createHash("sha256").update(query).digest("hex"),
        selectionRole: "questionnaire_assertion",
      },
    };
  });
}

function fromPersistedContext(
  row: typeof aiProcessingRunContext.$inferSelect,
): GroundingContextItem {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const channel =
    row.channel === "legal_authority" ? "legal" : "organization_document";
  const sourceId = row.legalSourceChunkId ?? row.documentChunkId;
  if (!sourceId) throw new Error("Persisted grounding context has no source");
  return {
    channel,
    citationId:
      typeof metadata.citationId === "string"
        ? metadata.citationId
        : `${channel === "legal" ? "LEGAL" : "DOC"}:${row.id}`,
    queryUnitId:
      typeof metadata.queryUnitId === "string" ? metadata.queryUnitId : "",
    sourceId,
    excerpt: row.exactText,
    excerptHash:
      typeof metadata.excerptHash === "string"
        ? metadata.excerptHash
        : createHash("sha256").update(row.exactText).digest("hex"),
    rank: typeof metadata.rank === "number" ? metadata.rank : row.position + 1,
    score: Number(row.fusedScore ?? 0),
    authorityTier:
      metadata.authorityTier === "primary_authority" ||
      metadata.authorityTier === "official_guidance" ||
      metadata.authorityTier === "curated_secondary"
        ? metadata.authorityTier
        : undefined,
    translationStatus:
      metadata.translationStatus === "official" ||
      metadata.translationStatus === "reviewed_internal" ||
      metadata.translationStatus === "machine_assisted"
        ? metadata.translationStatus
        : undefined,
    metadata,
  };
}

function snapshotPinsFromManifest(value: unknown): PinnedLegalSnapshot[] {
  if (!isRecord(value) || !Array.isArray(value.pinnedSnapshots)) return [];
  return value.pinnedSnapshots.filter(isPinnedSnapshot);
}

function isPinnedSnapshot(value: unknown): value is PinnedLegalSnapshot {
  return (
    isRecord(value) &&
    typeof value.familyId === "string" &&
    typeof value.familyCode === "string" &&
    typeof value.snapshotId === "string" &&
    typeof value.snapshotHash === "string"
  );
}

function numericScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(8)
    : null;
}

async function runLanguageNeutralProvider<T>(input: {
  provider: GroundedProvider;
  prompt: { system: string; prompt: string };
  schema: z.ZodType<T>;
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
    usage: result.usage,
  };
}

function configuredProviders() {
  const providers: Partial<Record<AiProviderMode, GroundedProvider>> = {};
  for (const mode of ["company_hosted", "self_hosted", "openai"] as const) {
    try {
      providers[mode] = createAiSdkGroundedProvider(mode);
    } catch {
      // Provider configuration is validated by the selection policy.
    }
  }
  return providers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
