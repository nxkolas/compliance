import { createHash } from "node:crypto";
import type * as z from "zod";
import type { AiProviderMode } from "@/src/server/platform/ai/types";
import { db } from "@/src/db";
import { aiProcessingRunContext, aiProcessingRuns } from "@/src/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { buildGroundedPrompt } from "./context-builder";
import {
  resolvePinnedLegalScope,
  retrievePinnedLegalContext,
  type PinnedLegalSnapshot,
} from "./legal-retrieval";
import { retrieveOrganizationContext } from "./organization-retrieval";
import { retrieveGuidanceContext } from "./guidance-retrieval";
import { resolveGroundingPolicy } from "./policy";
import { selectGroundedProvider } from "./provider-policy";
import { createAiSdkGroundedProvider } from "./providers/ai-sdk";
import { createClientRelayGroundedProvider } from "./providers/client-relay";
import { isClientInferenceSuspended } from "../../platform/ai/client-inference/types";
import {
  generationSettingsFrom,
  readOrganizationModelSettings,
} from "../organizations/model-settings-service";
import { getGenerationOptions } from "@/src/server/platform/ai/generation-options";
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
import type { ContentEmbedder } from "@/src/server/platform/content-processing";
import { withProviderPermit } from "./provider-limiter";
import {
  assertLiveParentJobForAiRun,
  createAiProcessingRunWithLiveJobGate,
} from "../../platform/ai/generation/job-run-lifecycle";
import { hashExactPrompt } from "../../platform/ai/generation/prompt-provenance";
import { contentHash } from "../compliance";

export type PreparedGroundingOperation = {
  policy: Awaited<ReturnType<typeof resolveGroundingPolicy>>;
  provider: GroundedProvider;
  pinnedSnapshots: PinnedLegalSnapshot[];
};

export type GroundingExecutionDependencies = {
  providers?: Partial<Record<AiProviderMode, GroundedProvider>>;
  languageDetector?: LanguageDetector;
  embeddingProvider?: ContentEmbedder;
};

type GroundedOperationInput<T> = {
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
  /**
   * Grounding rules for this operation. Required, and supplied per contract:
   * an instruction that names an action the contract's schema cannot express
   * has nowhere legitimate to land and leaks into prose instead.
   */
  groundingInstruction: string;
  outputLocaleInstruction: string;
  systemInstruction?: string;
  outputContract: GroundedOutputContract<T>;
  idempotencyKey: string;
  generationReservationKey?: string;
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
    organizationId: string;
    workflowReleaseId: string;
    jobId?: string | null;
  },
  dependencies: Pick<GroundingExecutionDependencies, "providers"> = {},
): Promise<PreparedGroundingOperation> {
  const policy = await resolveGroundingPolicy({
    organizationId: input.organizationId,
  });
  const provider = selectGroundedProvider({
    selectedMode: policy.providerPolicy.selectedProviderMode,
    providers:
      dependencies.providers ??
      (await configuredProviders({
        organizationId: input.organizationId,
        jobId: input.jobId,
      })),
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
        organizationId: input.organizationId,
        workflowReleaseId: input.workflowReleaseId,
        jobId: input.jobId,
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
  let resumedRun: typeof aiProcessingRuns.$inferSelect | null = null;
  if (existing) {
    // A previous execution parked this exact call waiting for an
    // organization browser. The client's answer is found by input hash when
    // the relay provider re-enters, so this run continues rather than
    // colliding with its own attempt identity. Any other existing run is a
    // genuine duplicate.
    if (existing.status === "awaiting_client" && existing.validatedOutput === null) {
      const [reset] = await db
        .update(aiProcessingRuns)
        .set({
          status: "processing",
          failureCode: null,
          failureMessage: null,
          completedAt: null,
        })
        .where(
          and(
            eq(aiProcessingRuns.id, existing.id),
            eq(aiProcessingRuns.status, "awaiting_client"),
          ),
        )
        .returning();
      if (!reset) {
        throw new ApiError(
          409,
          "Grounded operation already exists",
          { runId: existing.id },
          "GROUNDING_RUN_EXISTS",
        );
      }
      resumedRun = reset;
    } else {
      throw new ApiError(
        409,
        "Grounded operation already exists",
        { runId: existing.id },
        "GROUNDING_RUN_EXISTS",
      );
    }
  }
  const provider = withProviderPermit(prepared.provider, {
    jobId: input.jobId,
    categoryCode:
      input.queryUnits.length === 1 ? input.queryUnits[0]?.id : undefined,
  });
  const retrieved = (
    await Promise.all(
      input.queryUnits.map(async (unit) => {
        const [legal, organization, guidance] = await Promise.all([
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
          // Bound to the same provision keys the legal channel already uses, so
          // no caller has to supply anything new. Optional by design: a
          // category with no reviewed binding simply gets none.
          retrieveGuidanceContext({
            queryUnitId: unit.id,
            provisionKeys: unit.preferredMappedLegalProvisionKeys ?? [],
          }),
        ]);
        return [...legal, ...organization, ...guidance];
      }),
    )
  ).flat();
  const context = [
    ...retrieved,
    ...questionnaireContext(input.queryUnits, input.questionnaireAssertions),
  ];
  const schema = input.outputContract.schema(context);
  const prompt = buildGroundedPrompt(input.queryUnits, context);
  prompt.system += ` ${input.groundingInstruction} ${input.outputLocaleInstruction}`;
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
  const run = resumedRun ?? (await createAiProcessingRunWithLiveJobGate({
      organizationId: input.organizationId,
      jobId: input.jobId,
      idempotencyKey: input.idempotencyKey,
      generationReservationKey: input.generationReservationKey,
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
    }, new Date(), input.expectedLeaseOwner));

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
      // Guidance is excluded alongside questionnaire assertions: it is neither
      // evidence nor citable, nothing references it downstream, and
      // `ai_processing_run_context.channel` is an enum with a CHECK requiring a
      // matching chunk FK. Its provenance travels in the run manifest instead.
      const persistable = context.filter(
        (item) =>
          item.channel !== "questionnaire_assertion" &&
          item.channel !== "guidance",
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
    if (isClientInferenceSuspended(error)) {
      // Not a failure: the server has handed the call to an organization
      // browser and is waiting. Keep the run recognisable as in-flight so a
      // later execution of the same parked job resumes it instead of
      // treating it as a duplicate.
      await db
        .update(aiProcessingRuns)
        .set({
          status: "awaiting_client",
          failureCode: null,
          failureMessage: null,
          completedAt: null,
        })
        .where(eq(aiProcessingRuns.id, run.id));
      throw error;
    }
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
  durableExecutionAttempt?: number;
  providerAttempt?: number;
  jobId?: string;
  expectedLeaseOwner?: string;
}) {
  const values = [
    input.generationReservationKey,
    input.durableExecutionAttempt,
    input.providerAttempt,
  ];
  if (values.every((value) => value === undefined)) return;
  if (
    !input.generationReservationKey ||
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

/**
 * Builds the provider for each mode this organization could use.
 *
 * `openai` always calls the model directly from the server. `self_hosted` has
 * two shapes and the organization's own configuration decides which:
 *
 * - An organization that has recorded its chosen models runs them on a user's
 *   machine, which a deployed function cannot reach, so its calls go through
 *   the browser relay.
 * - An organization without that record falls back to the deployment's
 *   `SELF_HOSTED_AI_*` endpoint, called directly. That is the single-model
 *   local development setup in the runbook, and the on-premises topology where
 *   the server and the model share a network.
 *
 * This is the only place the choice is made, so all three generation call sites
 * inherit it without knowing the relay exists.
 */
/**
 * The provider one organization should use, resolved the same way the gateway
 * resolves its own. Exported for the call sites that construct a provider
 * outside `runGroundedOperation`, so they cannot silently miss the relay.
 */
export async function resolveGroundedProviderForOrganization(input: {
  organizationId: string;
  providerMode: AiProviderMode;
  jobId?: string | null;
}) {
  return selectGroundedProvider({
    selectedMode: input.providerMode,
    providers: await configuredProviders({
      organizationId: input.organizationId,
      jobId: input.jobId,
    }),
  });
}

async function configuredProviders(input: {
  organizationId?: string;
  jobId?: string | null;
}) {
  const providers: Partial<Record<AiProviderMode, GroundedProvider>> = {};
  try {
    providers.openai = createAiSdkGroundedProvider("openai");
  } catch {
    // Provider configuration is validated by the selection policy.
  }

  const settings = input.organizationId
    ? await readOrganizationModelSettings(input.organizationId)
    : null;

  if (settings) {
    const generation = generationSettingsFrom(settings);
    providers.self_hosted = createClientRelayGroundedProvider({
      organizationId: input.organizationId!,
      jobId: input.jobId ?? null,
      model: generation.model,
      providerOptions: getGenerationOptions("self_hosted", {
        thinking: false,
        thinkingStyle: generation.thinkingStyle,
      }).providerOptions,
    });
    return providers;
  }

  try {
    providers.self_hosted = createAiSdkGroundedProvider("self_hosted");
  } catch {
    // Provider configuration is validated by the selection policy.
  }
  return providers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
