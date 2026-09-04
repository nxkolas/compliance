import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { backgroundJobs } from "./jobs";
import { createdAt } from "./_shared";
import { legalSourceChunks, processingStatusEnum } from "./legal-corpus";
import { documentChunks } from "./documents";

export const clientInferenceKindEnum = pgEnum("client_inference_kind", [
  "generation",
  "embedding",
]);

export const clientInferenceStatusEnum = pgEnum("client_inference_status", [
  "pending",
  "claimed",
  "succeeded",
  "failed",
  "expired",
]);

export const aiOperationKindEnum = pgEnum("ai_operation_kind", [
  "applicability",
  "gap_analysis",
  "gap_conflict_resolution",
  "action_plan_generation",
]);

export const groundingContextChannelEnum = pgEnum(
  "grounding_context_channel",
  ["organization_evidence", "legal_authority"],
);

/**
 * One inference call the server has prepared for an organization's browser to
 * execute against a model on the user's own machine.
 *
 * A deployed function cannot reach a user's loopback address, so the browser is
 * the transport: the server assembles the prompt or the embedding input, parks
 * the job, and a client belonging to the same organization claims the row,
 * calls its local model, and posts the result back.
 *
 * `input_hash` is what makes a parked job resumable. One gap analysis is
 * categories x phases x attempts separate calls, and the job re-executes from
 * the start each time it wakes. Calls already answered are found by hash and
 * returned without asking the client again, so each wake-up advances the job
 * rather than repeating it.
 *
 * Everything a client returns is untrusted. The row records what came back; the
 * grounding gateway decides whether it is admissible.
 */
export const clientInferenceRequests = pgTable.withRLS(
  "client_inference_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: clientInferenceKindEnum("kind").notNull(),
    jobId: uuid("job_id").references(() => backgroundJobs.id, {
      onDelete: "cascade",
    }),
    runId: uuid("run_id").references(() => aiProcessingRuns.id, {
      onDelete: "cascade",
    }),
    // The exact request: prompt and JSON schema for generation, input values
    // and purpose for embedding.
    requestPayload: jsonb("request_payload").notNull(),
    inputHash: text("input_hash").notNull(),
    // What the server asked for. The client reports what actually answered, and
    // the two are compared rather than assumed equal.
    modelId: text("model_id").notNull(),
    status: clientInferenceStatusEnum("status").default("pending").notNull(),
    claimedBy: uuid("claimed_by"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").default(0).notNull(),
    response: jsonb("response"),
    // Everything below is *attested*, not measured. A local model reports it
    // through a client the server does not control, so it is kept here rather
    // than in `ai_processing_runs.input_tokens` and friends, which carry
    // metered provider usage that cost reporting reads back. Mixing the two
    // would make a customer's self-reported numbers indistinguishable from
    // billed ones.
    reportedModelId: text("reported_model_id"),
    attestedInputTokens: integer("attested_input_tokens"),
    attestedOutputTokens: integer("attested_output_tokens"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("client_inference_requests_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    // The resume key. One answered call per exact input per job, so a
    // re-executing job finds its previous answer instead of re-asking.
    uniqueIndex("client_inference_requests_input_unique").on(
      table.organizationId,
      table.jobId,
      table.inputHash,
    ),
    // Claim lookups: oldest pending request for one organization.
    index("client_inference_requests_claimable_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    check(
      "client_inference_requests_lifecycle_check",
      sql`(${table.status} = 'pending' and ${table.claimedBy} is null and ${table.response} is null)
        or (${table.status} = 'claimed' and ${table.claimedBy} is not null and ${table.leaseExpiresAt} is not null)
        or (${table.status} = 'succeeded' and ${table.response} is not null and ${table.respondedAt} is not null)
        or (${table.status} in ('failed', 'expired'))`,
    ),
    // An embedding request never belongs to an AI processing run: embeddings
    // are not an auditable generation. A generation request usually does, but
    // the run row is created after the provider is built, so the link is
    // recorded when it is known rather than required up front. Identity comes
    // from the job and the input hash, not from the run.
    check(
      "client_inference_requests_run_check",
      sql`${table.kind} = 'generation' or ${table.runId} is null`,
    ),
  ],
);

export const aiProcessingRuns = pgTable.withRLS(
  "ai_processing_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    jobId: uuid("job_id"),
    idempotencyKey: text("idempotency_key")
      .default(sql`gen_random_uuid()::text`)
      .notNull(),
    generationReservationKey: text("generation_reservation_key"),
    durableExecutionAttempt: integer("durable_execution_attempt"),
    providerAttempt: integer("provider_attempt"),
    operationKind: aiOperationKindEnum("operation_kind").notNull(),
    status: processingStatusEnum("status").default("pending").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptName: text("prompt_name").notNull(),
    promptVersion: text("prompt_version").notNull(),
    promptHash: text("prompt_hash").notNull(),
    definitionHash: text("definition_hash").notNull(),
    buildHash: text("build_hash").notNull(),
    inputManifest: jsonb("input_manifest").notNull(),
    claimValidation: jsonb("claim_validation").notNull(),
    validatedOutput: jsonb("validated_output"),
    outputLocale: varchar("output_locale", { length: 5 }).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("ai_processing_runs_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "ai_processing_runs_job_tenant_fk",
      columns: [table.organizationId, table.jobId],
      foreignColumns: [backgroundJobs.organizationId, backgroundJobs.id],
    }).onDelete("restrict"),
    uniqueIndex("ai_processing_runs_operation_idempotency_unique").on(
      table.organizationId,
      table.operationKind,
      table.idempotencyKey,
    ),
    index("ai_processing_runs_job_idx").on(table.jobId),
    index("ai_processing_runs_generation_reservation_idx").on(
      table.organizationId,
      table.operationKind,
      table.generationReservationKey,
    ),
    check("ai_processing_runs_locale_check", sql`${table.outputLocale} in ('de', 'en')`),
    check(
      "ai_processing_runs_generation_attempt_check",
      sql`(${table.generationReservationKey} is null and ${table.durableExecutionAttempt} is null and ${table.providerAttempt} is null) or (${table.generationReservationKey} is not null and ${table.durableExecutionAttempt} > 0 and ${table.providerAttempt} > 0)`,
    ),
    check(
      "ai_processing_runs_lifecycle_check",
      sql`(${table.status} = 'succeeded' and ${table.completedAt} is not null and ${table.validatedOutput} is not null and ${table.failureCode} is null) or (${table.status} = 'failed' and ${table.completedAt} is not null and ${table.failureCode} is not null) or (${table.status} in ('pending', 'processing', 'awaiting_client') and ${table.completedAt} is null)`,
    ),
  ],
);

export const aiProcessingRunContext = pgTable.withRLS(
  "ai_processing_run_context",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    runId: uuid("run_id").notNull(),
    channel: groundingContextChannelEnum("channel").notNull(),
    documentChunkId: uuid("document_chunk_id").references(() => documentChunks.id, {
      onDelete: "restrict",
    }),
    legalSourceChunkId: uuid("legal_source_chunk_id").references(
      () => legalSourceChunks.id,
      { onDelete: "restrict" },
    ),
    contextRole: text("context_role").notNull(),
    exactText: text("exact_text").notNull(),
    vectorScore: numeric("vector_score", { precision: 10, scale: 8 }),
    keywordScore: numeric("keyword_score", { precision: 10, scale: 8 }),
    fusedScore: numeric("fused_score", { precision: 10, scale: 8 }),
    metadata: jsonb("metadata").default({}).notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "ai_processing_run_context_run_tenant_fk",
      columns: [table.organizationId, table.runId],
      foreignColumns: [aiProcessingRuns.organizationId, aiProcessingRuns.id],
    }).onDelete("cascade"),
    uniqueIndex("ai_processing_run_context_run_position_unique").on(
      table.runId,
      table.position,
    ),
    uniqueIndex("ai_processing_run_context_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    check(
      "ai_processing_run_context_source_check",
      sql`num_nonnulls(${table.documentChunkId}, ${table.legalSourceChunkId}) = 1`,
    ),
    check(
      "ai_processing_run_context_channel_check",
      sql`(${table.channel} = 'organization_evidence' and ${table.documentChunkId} is not null) or (${table.channel} = 'legal_authority' and ${table.legalSourceChunkId} is not null)`,
    ),
  ],
);
