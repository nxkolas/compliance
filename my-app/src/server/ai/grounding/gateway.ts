import { createHash } from "node:crypto";
import type * as z from "zod";
import type { AiProviderMode } from "@/lib/ai/types";
import { db } from "@/src/db";
import { aiProcessingRunContext, aiProcessingRuns } from "@/src/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
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
import type { DocumentEmbeddingProvider } from "@/src/server/documents";
import { withProviderPermit } from "./provider-limiter";
import {
  assertLiveParentJobForAiRun,
  createAiProcessingRunWithLiveJobGate,
} from "../generation/job-run-lifecycle";
import { hashExactPrompt } from "../generation/prompt-provenance";
import { contentHash } from "../../compliance";

export type PreparedGroundingOperation = {
  policy: Awaited<ReturnType<typeof resolveGroundingPolicy>>;
  provider: GroundedProvider;
  pinnedSnapshots: PinnedLegalSnapshot[];
};

export type GroundingExecutionDependencies = {
  providers?: Partial<Record<AiProviderMode, GroundedProvider>>;
  languageDetector?: LanguageDetector;
  embeddingProvider?: DocumentEmbeddingProvider;
};

type GroundedOperationInput<T> = {
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
  generationReservationKey?: string;
  generationAttemptKey?: string;
  durableExecutionAttempt?: number;
  providerAttempt?: number;
  assessmentRevisionId?: string;
  jobId?: string;
  expectedLeaseOwner?: string;
  definitionHash?: string;
  promptMetadata?: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  abortSignal?: AbortSignal;
  // Legal grounding needs no embedding: it resolves reviewed provision
  // bindings and otherwise ranks lexically.
  precomputedQueryEmbeddings?: {
    organizationDocument?: number[];
  };
  preparedGrounding?: PreparedGroundingOperation;
};

type RecoveryCompatibility = {
  version: 1;
  jobId: string | undefined;
  workflowReleaseId: string;
  definitionHash: string;
  outputLocale: "de" | "en";
  assessmentRevisionId: string | null;
  asOfDate: string;
  queryUnits: QueryUnit[];
  organizationEvidenceVersionIds: string[];
  pinnedSnapshots: PinnedLegalSnapshot[];
  promptContract: GroundedOperationInput<unknown>["promptMetadata"] | null;
};

export async function prepareGroundingOperation(
  input: {
    operation: "gap_analysis";
    organizationId: string;
    workflowReleaseId: string;
  },
  dependencies: Pick<GroundingExecutionDependencies, "providers"> = {},
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
  input: GroundedOperationInput<T>,
  dependencies: GroundingExecutionDependencies = {},
) {
  const operationKind = input.runOperationKind ?? "gap_analysis";
  assertGenerationAttemptInput(input);
  if (input.jobId && input.expectedLeaseOwner) {
    await assertLiveParentJobForAiRun({
      jobId: input.jobId,
      organizationId: input.organizationId,
      expectedLeaseOwner: input.expectedLeaseOwner,
    });
  }
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
  const recoveryCompatibility = buildRecoveryCompatibility(input, prepared);
  if (input.generationReservationKey) {
    const recoverable = await db.query.aiProcessingRuns.findFirst({
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.organizationId, input.organizationId),
            eq(table.operationKind, operationKind),
            eq(table.jobId, input.jobId!),
            eq(
              table.generationReservationKey,
              input.generationReservationKey!,
            ),
            eq(table.status, "processing"),
            isNotNull(table.validatedOutput),
          ) ?? operators.sql`true`,
      },
      orderBy: { createdAt: "desc" },
    });
    const recovered = recoverable
      ? await recoverValidatedRun(
          recoverable,
          input,
          prepared,
          recoveryCompatibility,
        )
      : null;
    if (recovered) return recovered;
  } else if (
    existing?.status === "processing" &&
    existing.validatedOutput !== null
  ) {
    const recovered = await recoverValidatedRun(
      existing,
      input,
      prepared,
      undefined,
    );
    if (recovered) return recovered;
  }
  if (existing?.status === "succeeded") {
    throw new ApiError(
      409,
      "This grounded result was already published",
      { runId: existing.id },
      "GROUNDING_RUN_ALREADY_PUBLISHED",
    );
  }
  if (existing) {
    throw new ApiError(
      409,
      "Grounded operation already exists",
      { runId: existing.id },
      "GROUNDING_RUN_EXISTS",
    );
  }
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
  const promptHash = hashExactPrompt({
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.prompt },
    ],
    responseSchema: input.promptMetadata
      ? {
          name: input.promptMetadata.name,
          version: input.promptMetadata.version,
          templateHash: input.promptMetadata.templateHash,
          schemaVersion: input.promptMetadata.responseSchemaVersion,
        }
      : { name: "grounded-generation", version: "1" },
  });
  const manifest = {
    version: input.generationReservationKey ? 2 : 1,
    assessmentRevisionId: input.assessmentRevisionId ?? null,
    queryUnits: input.queryUnits,
    organizationEvidenceVersionIds: input.organizationEvidenceVersionIds,
    pinnedSnapshots: prepared.pinnedSnapshots,
    renderedInputHash,
    ...(recoveryCompatibility
      ? { recoveryCompatibility }
      : {}),
  };
  const run = await createAiProcessingRunWithLiveJobGate({
      organizationId: input.organizationId,
      jobId: input.jobId,
      idempotencyKey: input.idempotencyKey,
      generationReservationKey: input.generationReservationKey,
      generationAttemptKey: input.generationAttemptKey,
      durableExecutionAttempt: input.durableExecutionAttempt,
      providerAttempt: input.providerAttempt,
      operationKind,
      status: "processing",
      provider: provider.provider,
      model: provider.model,
      promptName: input.promptMetadata?.name ?? "grounded-generation",
      promptVersion: input.promptMetadata?.version ?? "1",
      promptHash,
      definitionHash: input.definitionHash ?? input.workflowReleaseId,
      buildHash: process.env.APP_BUILD_SHA ?? input.workflowReleaseId,
      inputManifest: manifest,
      claimValidation: { version: 1, status: "pending" },
      outputLocale: input.outputLocale,
      startedAt: new Date(),
    }, new Date(), input.expectedLeaseOwner);

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
              label: item.label,
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
      recovered: false as const,
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

function assertGenerationAttemptInput(input: {
  idempotencyKey: string;
  generationReservationKey?: string;
  generationAttemptKey?: string;
  durableExecutionAttempt?: number;
  providerAttempt?: number;
  jobId?: string;
  expectedLeaseOwner?: string;
}) {
  const values = [
    input.generationReservationKey,
    input.generationAttemptKey,
    input.durableExecutionAttempt,
    input.providerAttempt,
  ];
  if (values.every((value) => value === undefined)) return;
  if (
    !input.generationReservationKey ||
    !input.generationAttemptKey ||
    input.idempotencyKey !== input.generationAttemptKey ||
    !Number.isInteger(input.durableExecutionAttempt) ||
    input.durableExecutionAttempt! < 1 ||
    !Number.isInteger(input.providerAttempt) ||
    input.providerAttempt! < 1 ||
    !input.jobId ||
    !input.expectedLeaseOwner
  ) {
    throw new Error("Grounded generation attempt identity is incomplete");
  }
}

function buildRecoveryCompatibility<T>(
  input: GroundedOperationInput<T>,
  prepared: PreparedGroundingOperation,
): RecoveryCompatibility | undefined {
  if (!input.generationReservationKey) return undefined;
  return {
    version: 1,
    jobId: input.jobId,
    workflowReleaseId: input.workflowReleaseId,
    definitionHash: input.definitionHash ?? input.workflowReleaseId,
    outputLocale: input.outputLocale,
    assessmentRevisionId: input.assessmentRevisionId ?? null,
    asOfDate: input.asOfDate,
    queryUnits: input.queryUnits,
    organizationEvidenceVersionIds: input.organizationEvidenceVersionIds,
    pinnedSnapshots: prepared.pinnedSnapshots,
    promptContract: input.promptMetadata ?? null,
  };
}

async function recoverValidatedRun<T>(
  run: typeof aiProcessingRuns.$inferSelect,
  input: GroundedOperationInput<T>,
  prepared: PreparedGroundingOperation,
  expectedCompatibility: RecoveryCompatibility | undefined,
) {
  if (
    run.status !== "processing" ||
    run.validatedOutput === null ||
    run.jobId !== (input.jobId ?? null) ||
    run.definitionHash !== (input.definitionHash ?? input.workflowReleaseId) ||
    run.outputLocale !== input.outputLocale
  ) {
    return null;
  }
  if (expectedCompatibility) {
    const manifest = isRecord(run.inputManifest) ? run.inputManifest : null;
    if (
      !manifest ||
      manifest.version !== 2 ||
      contentHash(manifest.recoveryCompatibility) !==
        contentHash(expectedCompatibility)
    ) {
      return null;
    }
  }
  const persisted = await db.query.aiProcessingRunContext.findMany({
    where: {
      RAW: (table, operators) =>
        eq(table.runId, run.id) ?? operators.sql`true`,
    },
    orderBy: { position: "asc" },
  });
  const context = [
    ...persisted.map(fromPersistedContext),
    ...questionnaireContext(input.queryUnits, input.questionnaireAssertions),
  ];
  const output = input.outputContract.schema(context).safeParse(run.validatedOutput);
  if (!output.success) return null;
  return {
    runId: run.id,
    output: output.data,
    outputLocale: run.outputLocale,
    context,
    claims: [],
    recovered: true as const,
    pinnedSnapshots: snapshotPinsFromManifest(run.inputManifest).length
      ? snapshotPinsFromManifest(run.inputManifest)
      : prepared.pinnedSnapshots,
  };
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
      label: `Q${index + 1}`,
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
    // Persisted so a recovered run rebuilds the exact labels the model saw.
    label:
      typeof metadata.label === "string"
        ? metadata.label
        : `${channel === "legal" ? "L" : "D"}${row.position + 1}`,
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
