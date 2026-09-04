import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_shared";
import { backgroundJobs } from "./jobs";
import { processingStatusEnum } from "./legal-corpus";

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "contributor",
  "viewer",
]);

/**
 * The two ways an organization can have AI work done.
 *
 * `openai` runs on the server. `self_hosted` runs on a model the organization
 * operates itself, reached through a browser the organization controls, because
 * a deployed function cannot reach a user's loopback address.
 */
export const aiProviderModeEnum = pgEnum("ai_provider_mode", [
  "openai",
  "self_hosted",
]);

export const organizations = pgTable.withRLS(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    legalName: varchar("legal_name", { length: 240 }),
    countryCode: varchar("country_code", { length: 2 }).default("DE").notNull(),
    // The organization's single AI provider choice, governing generation and
    // embeddings alike. It advances only once a re-embedding migration has
    // rebuilt every stored vector, so it can never disagree with the data.
    aiProviderMode: aiProviderModeEnum("ai_provider_mode")
      .default("openai")
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "organizations_country_code_check",
      sql`${table.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    uniqueIndex("organizations_id_identity_unique").on(table.id),
  ],
);

/**
 * One row per requested change of an organization's embedding coordinates.
 *
 * Changing the embedding model, its revision, its output dimensions, the
 * retrieval instruction applied to queries, or the chunking version all change
 * the vector space, and vectors from two spaces are not comparable. Those five
 * facts are hashed into one `embedding_key`, and a change to any of them stages
 * a migration here rather than taking effect immediately. The organization's
 * active coordinates advance only when a migration reaches `succeeded`, in the
 * same transaction that finishes it. Keeping the in-flight state out of
 * `organizations` is what makes a disagreement between the choice and the
 * vectors unable to exist rather than merely discouraged.
 *
 * The provider columns are audit only. They were the invalidation key before
 * the model became a per-organization choice, and they are nullable because a
 * migration is now routinely triggered by a model change within one provider.
 */
export const organizationEmbeddingMigrations = pgTable.withRLS(
  "organization_embedding_migrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => backgroundJobs.id, {
      onDelete: "set null",
    }),
    fromProviderMode: aiProviderModeEnum("from_provider_mode"),
    toProviderMode: aiProviderModeEnum("to_provider_mode"),
    fromEmbeddingKey: text("from_embedding_key").notNull(),
    toEmbeddingKey: text("to_embedding_key").notNull(),
    // The full resolved target configuration, pinned at request time. The
    // re-index job must embed with exactly these coordinates even if the
    // organization's settings are edited again while it runs.
    toEmbeddingConfig: jsonb("to_embedding_config").notNull(),
    status: processingStatusEnum("status").default("pending").notNull(),
    documentVersionsTotal: integer("document_versions_total")
      .default(0)
      .notNull(),
    documentVersionsCompleted: integer("document_versions_completed")
      .default(0)
      .notNull(),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    // Shortened deliberately: the conventional
    // "<table>_organization_id_identity_unique" name exceeds PostgreSQL's
    // 63-character identifier limit for this table and would be truncated.
    uniqueIndex("organization_embedding_migrations_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    // At most one migration may be outstanding per organization. This replaces
    // a nullable "pending" column: a terminal row cannot strand the guard.
    uniqueIndex("organization_embedding_migrations_active_unique")
      .on(table.organizationId)
      .where(sql`${table.status} in ('pending', 'processing')`),
    check(
      "organization_embedding_migrations_lifecycle_check",
      sql`(${table.status} = 'succeeded' and ${table.completedAt} is not null and ${table.failureCode} is null) or (${table.status} = 'failed' and ${table.completedAt} is not null and ${table.failureCode} is not null) or (${table.status} in ('pending', 'processing') and ${table.completedAt} is null)`,
    ),
    check(
      "organization_embedding_migrations_progress_check",
      sql`${table.documentVersionsCompleted} >= 0 and ${table.documentVersionsCompleted} <= ${table.documentVersionsTotal}`,
    ),
    // A migration that changes nothing has no reason to exist. This is now
    // keyed on the embedding identity rather than the provider: a model change
    // within one provider is the ordinary case.
    check(
      "organization_embedding_migrations_direction_check",
      sql`${table.fromEmbeddingKey} <> ${table.toEmbeddingKey}`,
    ),
  ],
);

/**
 * One organization's chosen models, for organizations running their own.
 *
 * The row exists only for `self_hosted` organizations: an `openai` organization
 * uses the deployment's configured models, because there is nothing for it to
 * choose. Absence of a row is therefore meaningful, not a missing default.
 *
 * The two halves behave differently on purpose. The generation columns are
 * freely updatable -- swapping the generation model costs nothing, because no
 * stored data depends on it. The embedding columns are the organization's
 * *active* coordinates and may only advance through a succeeded
 * `organization_embedding_migrations` row, because every stored vector was
 * produced by them.
 *
 * The capability columns are probe results, not preferences. They record what
 * the model was observed to do when the organization connected it, which is the
 * only way to know: a model that ignores a JSON schema returns HTTP 200 with
 * invented keys rather than failing.
 */
export const organizationModelSettings = pgTable.withRLS(
  "organization_model_settings",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    generationModelId: text("generation_model_id").notNull(),
    generationMaxContextTokens: integer("generation_max_context_tokens").notNull(),
    generationSupportsStructuredOutputs: boolean(
      "generation_supports_structured_outputs",
    ).notNull(),
    // Which no-thinking switch this server understands. Ollama honours
    // `reasoning_effort`; vLLM reads `chat_template_kwargs`. Sending the wrong
    // one leaves a thinking model spending its whole output budget reasoning
    // and returning empty content.
    generationThinkingStyle: text("generation_thinking_style")
      .default("none")
      .notNull(),
    embeddingModelId: text("embedding_model_id").notNull(),
    embeddingRevision: text("embedding_revision").notNull(),
    embeddingDimensions: integer("embedding_dimensions").notNull(),
    embeddingInstructionProfile: text("embedding_instruction_profile")
      .default("none")
      .notNull(),
    probedAt: timestamp("probed_at", { withTimezone: true }),
    updatedBy: uuid("updated_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "organization_model_settings_context_check",
      sql`${table.generationMaxContextTokens} > 0`,
    ),
    // pgvector's storage ceiling. The column holding these vectors is
    // undimensioned, so this is the only place the bound is enforced.
    check(
      "organization_model_settings_dimensions_check",
      sql`${table.embeddingDimensions} between 1 and 16000`,
    ),
  ],
);

export const userProfiles = pgTable.withRLS(
  "user_profiles",
  {
    userId: uuid("user_id").primaryKey(),
    email: text("email").notNull(),
    displayName: varchar("display_name", { length: 160 }),
  },
  (table) => [uniqueIndex("user_profiles_email_unique").on(sql`lower(${table.email})`)],
);

export const organizationMemberships = pgTable.withRLS(
  "organization_memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: organizationRoleEnum("role").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("organization_memberships_user_idx").on(table.userId),
    index("organization_memberships_owner_idx").on(table.organizationId, table.role),
  ],
);

export const organizationInvitations = pgTable.withRLS(
  "organization_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: organizationRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("organization_invitations_token_unique").on(table.tokenHash),
    uniqueIndex("organization_invitations_pending_email_unique").on(
      table.organizationId,
      sql`lower(${table.email})`,
    ),
    check(
      "organization_invitations_role_check",
      sql`${table.role} in ('contributor', 'viewer')`,
    ),
    check(
      "organization_invitations_expiry_check",
      sql`${table.expiresAt} <= ${table.createdAt} + interval '14 days'`,
    ),
  ],
);
