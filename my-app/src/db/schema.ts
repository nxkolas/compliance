import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector(1536)",
  toDriver: (value) => `[${value.join(",")}]`,
  fromDriver: (value) =>
    value.slice(1, -1).split(",").filter(Boolean).map(Number),
});

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

function assessmentRevisionIdentity(): [AnyPgColumn, AnyPgColumn] {
  return [assessmentRevisions.assessmentId, assessmentRevisions.id];
}

function outputRevisionIdentity(): [AnyPgColumn, AnyPgColumn] {
  return [analysisOutputRevisions.outputId, analysisOutputRevisions.id];
}

function documentVersionIdentity(): [AnyPgColumn, AnyPgColumn] {
  return [documentVersions.documentId, documentVersions.id];
}

function corpusSnapshotIdentity(): [AnyPgColumn, AnyPgColumn] {
  return [legalCorpusSnapshots.familyId, legalCorpusSnapshots.id];
}

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "contributor",
  "viewer",
]);

export const aiProviderModeEnum = pgEnum("ai_provider_mode", [
  "company_hosted",
  "openai",
  "self_hosted",
]);

export const assessmentKindEnum = pgEnum("assessment_kind", [
  "applicability",
  "gap",
]);

export const analysisOutputKindEnum = pgEnum("analysis_output_kind", [
  "applicability",
  "gap",
]);

export const gapAnalysisCycleStageEnum = pgEnum("gap_analysis_cycle_stage", [
  "questions",
  "evidence",
  "generating",
  "generated",
]);

export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
]);

export const aiOperationKindEnum = pgEnum("ai_operation_kind", [
  "applicability",
  "gap_analysis",
  "gap_conflict_resolution",
  "action_plan_generation",
]);

export const gapFindingStatusEnum = pgEnum("gap_finding_status", [
  "fulfilled",
  "partially_fulfilled",
  "not_fulfilled",
  "insufficient_evidence",
]);

export const gapItemKindEnum = pgEnum("gap_item_kind", [
  "missing",
  "partial",
  "uncertain",
]);

export const contradictionSourceChoiceEnum = pgEnum(
  "contradiction_source_choice",
  ["questionnaire", "document"],
);

export const contextLinkDispositionEnum = pgEnum("context_link_disposition", [
  "admitted",
  "rejected",
]);

export const contextLinkRelationshipEnum = pgEnum("context_link_relationship", [
  "supporting",
  "conflicting",
]);

export const actionPlanItemStatusEnum = pgEnum("action_plan_item_status", [
  "open",
  "in_progress",
  "done",
  "cancelled",
]);

export const backgroundJobStateEnum = pgEnum("background_job_state", [
  "queued",
  "leased",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const backgroundJobKindEnum = pgEnum("background_job_kind", [
  "gap_analysis",
  "gap_conflict_resolution",
  "action_plan_generation",
  "report_render",
  "document_indexing",
  "organization_reembedding",
  "legal_source_processing",
  "maintenance_cleanup",
]);

export const idempotencyStateEnum = pgEnum("idempotency_state", [
  "in_progress",
  "completed",
  "failed",
]);

export const uploadSessionStateEnum = pgEnum("upload_session_state", [
  "pending",
  "uploaded",
  "completed",
  "expired",
  "failed",
]);

export const legalAuthorityTierEnum = pgEnum("legal_authority_tier", [
  "official",
  "trusted_translation",
  "secondary",
]);

export const legalTranslationStatusEnum = pgEnum("legal_translation_status", [
  "original",
  "official",
  "reviewed",
  "unreviewed",
]);

export const groundingContextChannelEnum = pgEnum(
  "grounding_context_channel",
  ["organization_evidence", "legal_authority"],
);

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
 * One row per requested change of an organization's AI provider.
 *
 * Changing the provider changes the embedding model, which invalidates every
 * stored vector. `organizations.ai_provider_mode` therefore stays on the old
 * value until a migration here reaches `succeeded`, at which point both advance
 * in the same transaction. Keeping the in-flight state out of `organizations`
 * is what makes a disagreement between the choice and the vectors unable to
 * exist rather than merely discouraged.
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
    fromProviderMode: aiProviderModeEnum("from_provider_mode").notNull(),
    toProviderMode: aiProviderModeEnum("to_provider_mode").notNull(),
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
    // A migration that changes nothing has no reason to exist.
    check(
      "organization_embedding_migrations_direction_check",
      sql`${table.fromProviderMode} <> ${table.toProviderMode}`,
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

export const assessments = pgTable.withRLS(
  "assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: assessmentKindEnum("kind").notNull(),
    currentRevisionId: uuid("current_revision_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("assessments_organization_kind_unique").on(
      table.organizationId,
      table.kind,
    ),
    uniqueIndex("assessments_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "assessments_current_revision_identity_fk",
      columns: [table.id, table.currentRevisionId],
      foreignColumns: assessmentRevisionIdentity(),
    }).onDelete("restrict"),
  ],
);

export const assessmentRevisions = pgTable.withRLS(
  "assessment_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    assessmentId: uuid("assessment_id").notNull(),
    previousRevisionId: uuid("previous_revision_id"),
    definitionHash: text("definition_hash").notNull(),
    buildHash: text("build_hash").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    deterministicEvaluations: jsonb("deterministic_evaluations")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    inputHash: text("input_hash").notNull(),
    submittedBy: uuid("submitted_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "assessment_revisions_assessment_tenant_fk",
      columns: [table.organizationId, table.assessmentId],
      foreignColumns: [assessments.organizationId, assessments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "assessment_revisions_previous_identity_fk",
      columns: [table.assessmentId, table.previousRevisionId],
      foreignColumns: [table.assessmentId, table.id],
    }).onDelete("restrict"),
    uniqueIndex("assessment_revisions_assessment_id_identity_unique").on(
      table.assessmentId,
      table.id,
    ),
    uniqueIndex("assessment_revisions_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    index("assessment_revisions_assessment_submitted_idx").on(
      table.assessmentId,
      table.submittedAt,
    ),
    check("assessment_revisions_locale_check", sql`${table.locale} in ('de', 'en')`),
  ],
);

export const assessmentAnswers = pgTable.withRLS(
  "assessment_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    assessmentRevisionId: uuid("assessment_revision_id").notNull(),
    questionKey: text("question_key").notNull(),
    questionText: text("question_text").notNull(),
    answerValue: jsonb("answer_value").notNull(),
    selectedOptionLabels: jsonb("selected_option_labels")
      .$type<string[]>()
      .default([])
      .notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    foreignKey({
      name: "assessment_answers_revision_tenant_fk",
      columns: [table.organizationId, table.assessmentRevisionId],
      foreignColumns: [
        assessmentRevisions.organizationId,
        assessmentRevisions.id,
      ],
    }).onDelete("cascade"),
    uniqueIndex("assessment_answers_revision_question_unique").on(
      table.assessmentRevisionId,
      table.questionKey,
    ),
    check("assessment_answers_position_check", sql`${table.position} >= 0`),
  ],
);

export const guestApplicabilityChecks = pgTable.withRLS(
  "guest_applicability_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    claimTokenHash: text("claim_token_hash").notNull(),
    definitionHash: text("definition_hash").notNull(),
    buildHash: text("build_hash").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    answerSnapshot: jsonb("answer_snapshot").notNull(),
    resultSnapshot: jsonb("result_snapshot").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("guest_applicability_checks_token_unique").on(table.claimTokenHash),
    index("guest_applicability_checks_expiry_idx").on(table.expiresAt),
    check("guest_applicability_checks_locale_check", sql`${table.locale} in ('de', 'en')`),
    check(
      "guest_applicability_checks_expiry_check",
      sql`${table.expiresAt} <= ${table.submittedAt} + interval '14 days'`,
    ),
  ],
);

export const analysisOutputs = pgTable.withRLS(
  "analysis_outputs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: analysisOutputKindEnum("kind").notNull(),
    currentRevisionId: uuid("current_revision_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("analysis_outputs_organization_kind_unique").on(
      table.organizationId,
      table.kind,
    ),
    uniqueIndex("analysis_outputs_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "analysis_outputs_current_revision_identity_fk",
      columns: [table.id, table.currentRevisionId],
      foreignColumns: outputRevisionIdentity(),
    }).onDelete("restrict"),
  ],
);

export const analysisOutputRevisions = pgTable.withRLS(
  "analysis_output_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    outputId: uuid("output_id").notNull(),
    previousRevisionId: uuid("previous_revision_id"),
    assessmentRevisionId: uuid("assessment_revision_id").notNull(),
    sourceApplicabilityRevisionId: uuid("source_applicability_revision_id"),
    definitionHash: text("definition_hash").notNull(),
    buildHash: text("build_hash").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    inputHash: text("input_hash").notNull(),
    result: jsonb("result").notNull(),
    jurisdictionCode: varchar("jurisdiction_code", { length: 2 }),
    outcomeCode: text("outcome_code"),
    gapEligible: boolean("gap_eligible"),
    generationJobId: uuid("generation_job_id"),
    aiProcessingRunId: uuid("ai_processing_run_id"),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "analysis_output_revisions_output_tenant_fk",
      columns: [table.organizationId, table.outputId],
      foreignColumns: [analysisOutputs.organizationId, analysisOutputs.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "analysis_output_revisions_assessment_tenant_fk",
      columns: [table.organizationId, table.assessmentRevisionId],
      foreignColumns: [
        assessmentRevisions.organizationId,
        assessmentRevisions.id,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "analysis_output_revisions_applicability_tenant_fk",
      columns: [table.organizationId, table.sourceApplicabilityRevisionId],
      foreignColumns: [
        table.organizationId,
        table.id,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "analysis_output_revisions_previous_identity_fk",
      columns: [table.outputId, table.previousRevisionId],
      foreignColumns: [table.outputId, table.id],
    }).onDelete("restrict"),
    uniqueIndex("analysis_output_revisions_output_id_identity_unique").on(
      table.outputId,
      table.id,
    ),
    uniqueIndex("analysis_output_revisions_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    index("analysis_output_revisions_output_created_idx").on(
      table.outputId,
      table.createdAt,
    ),
    check("analysis_output_revisions_locale_check", sql`${table.locale} in ('de', 'en')`),
  ],
);

export const analysisOutputDocumentSources = pgTable.withRLS(
  "analysis_output_document_sources",
  {
    organizationId: uuid("organization_id").notNull(),
    outputRevisionId: uuid("output_revision_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.outputRevisionId, table.documentVersionId] }),
    foreignKey({
      name: "analysis_output_document_sources_output_tenant_fk",
      columns: [table.organizationId, table.outputRevisionId],
      foreignColumns: [
        analysisOutputRevisions.organizationId,
        analysisOutputRevisions.id,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "analysis_output_document_sources_document_tenant_fk",
      columns: [table.organizationId, table.documentVersionId],
      foreignColumns: [documentVersions.organizationId, documentVersions.id],
    }).onDelete("restrict"),
  ],
);

export const gapAnalysisCycles = pgTable.withRLS(
  "gap_analysis_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    definitionHash: text("definition_hash").notNull(),
    buildHash: text("build_hash").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    stage: gapAnalysisCycleStageEnum("stage").default("questions").notNull(),
    draftAnswers: jsonb("draft_answers")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    assessmentRevisionId: uuid("assessment_revision_id"),
    generationJobId: uuid("generation_job_id"),
    outputRevisionId: uuid("output_revision_id"),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    questionsCompletedAt: timestamp("questions_completed_at", {
      withTimezone: true,
    }),
    generationStartedAt: timestamp("generation_started_at", {
      withTimezone: true,
    }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("gap_analysis_cycles_unfinished_unique")
      .on(table.organizationId)
      .where(sql`${table.stage} <> 'generated'`),
    uniqueIndex("gap_analysis_cycles_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "gap_analysis_cycles_assessment_tenant_fk",
      columns: [table.organizationId, table.assessmentRevisionId],
      foreignColumns: [
        assessmentRevisions.organizationId,
        assessmentRevisions.id,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_analysis_cycles_output_tenant_fk",
      columns: [table.organizationId, table.outputRevisionId],
      foreignColumns: [
        analysisOutputRevisions.organizationId,
        analysisOutputRevisions.id,
      ],
    }).onDelete("restrict"),
    check("gap_analysis_cycles_locale_check", sql`${table.locale} in ('de', 'en')`),
    check(
      "gap_analysis_cycles_stage_lineage_check",
      sql`(${table.stage} in ('questions', 'evidence')) or ${table.assessmentRevisionId} is not null`,
    ),
  ],
);

export const gapAnalysisCycleDocuments = pgTable.withRLS(
  "gap_analysis_cycle_documents",
  {
    organizationId: uuid("organization_id").notNull(),
    cycleId: uuid("cycle_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.cycleId, table.documentVersionId] }),
    foreignKey({
      name: "gap_analysis_cycle_documents_cycle_tenant_fk",
      columns: [table.organizationId, table.cycleId],
      foreignColumns: [gapAnalysisCycles.organizationId, gapAnalysisCycles.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_analysis_cycle_documents_version_tenant_fk",
      columns: [table.organizationId, table.documentVersionId],
      foreignColumns: [documentVersions.organizationId, documentVersions.id],
    }).onDelete("restrict"),
  ],
);

export const documents = pgTable.withRLS(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 240 }).notNull(),
    currentVersionId: uuid("current_version_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("documents_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "documents_current_version_identity_fk",
      columns: [table.id, table.currentVersionId],
      foreignColumns: documentVersionIdentity(),
    }).onDelete("restrict"),
    index("documents_organization_archive_idx").on(
      table.organizationId,
      table.archivedAt,
    ),
  ],
);

export const documentVersions = pgTable.withRLS(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    documentId: uuid("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: text("content_hash").notNull(),
    indexingStatus: processingStatusEnum("indexing_status").default("pending").notNull(),
    parser: text("parser").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    indexingStartedAt: timestamp("indexing_started_at", { withTimezone: true }),
    indexingCompletedAt: timestamp("indexing_completed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "document_versions_document_tenant_fk",
      columns: [table.organizationId, table.documentId],
      foreignColumns: [documents.organizationId, documents.id],
    }).onDelete("cascade"),
    uniqueIndex("document_versions_document_number_unique").on(
      table.documentId,
      table.versionNumber,
    ),
    uniqueIndex("document_versions_document_id_identity_unique").on(
      table.documentId,
      table.id,
    ),
    uniqueIndex("document_versions_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("document_versions_storage_unique").on(
      table.storageBucket,
      table.storageKey,
    ),
    check("document_versions_number_check", sql`${table.versionNumber} > 0`),
    check("document_versions_byte_size_check", sql`${table.byteSize} > 0`),
    check(
      "document_versions_indexing_lifecycle_check",
      sql`(${table.indexingStatus} = 'succeeded' and ${table.indexingCompletedAt} is not null and ${table.failureCode} is null) or (${table.indexingStatus} = 'failed' and ${table.failureCode} is not null) or (${table.indexingStatus} in ('pending', 'processing') and ${table.indexingCompletedAt} is null)`,
    ),
  ],
);

export const documentChunks = pgTable.withRLS(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    position: integer("position").notNull(),
    pageNumber: integer("page_number"),
    sectionPath: text("section_path"),
    text: text("text").notNull(),
    contentHash: text("content_hash").notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce("text", ''))`,
    ),
    embedding: vector("embedding"),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "document_chunks_version_tenant_fk",
      columns: [table.organizationId, table.documentVersionId],
      foreignColumns: [documentVersions.organizationId, documentVersions.id],
    }).onDelete("cascade"),
    uniqueIndex("document_chunks_version_position_unique").on(
      table.documentVersionId,
      table.position,
    ),
    uniqueIndex("document_chunks_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    index("document_chunks_search_idx").using("gin", table.searchVector),
    check("document_chunks_position_check", sql`${table.position} >= 0`),
  ],
);

export const backgroundJobs = pgTable.withRLS(
  "background_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    kind: backgroundJobKindEnum("kind").notNull(),
    state: backgroundJobStateEnum("state").default("queued").notNull(),
    payload: jsonb("payload").notNull(),
    resultLocator: jsonb("result_locator"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    progressCurrent: integer("progress_current"),
    progressTotal: integer("progress_total"),
    progressMessage: text("progress_message"),
    cancellationRequestedAt: timestamp("cancellation_requested_at", {
      withTimezone: true,
    }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    requestedBy: uuid("requested_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("background_jobs_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("background_jobs_cleanup_active_unique")
      .on(table.kind)
      .where(sql`${table.kind} = 'maintenance_cleanup' and ${table.state} in ('queued', 'leased', 'running')`),
    uniqueIndex("background_jobs_reembedding_active_unique")
      .on(table.organizationId)
      .where(sql`${table.kind} = 'organization_reembedding' and ${table.state} in ('queued', 'leased', 'running')`),
    index("background_jobs_claim_idx").on(table.state, table.availableAt),
    index("background_jobs_lease_idx").on(table.leaseExpiresAt),
    check(
      "background_jobs_attempt_check",
      sql`${table.attemptCount} >= 0 and ${table.maxAttempts} > 0 and ${table.attemptCount} <= ${table.maxAttempts}`,
    ),
    check(
      "background_jobs_progress_check",
      sql`(${table.progressCurrent} is null and ${table.progressTotal} is null) or (${table.progressCurrent} >= 0 and ${table.progressTotal} > 0 and ${table.progressCurrent} <= ${table.progressTotal})`,
    ),
    check(
      "background_jobs_terminal_check",
      sql`(${table.state} in ('succeeded', 'failed', 'cancelled')) = (${table.finishedAt} is not null)`,
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
    jobId: uuid("job_id").references(() => backgroundJobs.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key")
      .default(sql`gen_random_uuid()::text`)
      .notNull(),
    generationReservationKey: text("generation_reservation_key"),
    generationAttemptKey: text("generation_attempt_key"),
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
    costAmount: numeric("cost_amount", { precision: 14, scale: 6 }),
    costCurrency: varchar("cost_currency", { length: 3 }),
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
    uniqueIndex("ai_processing_runs_generation_attempt_unique")
      .on(
        table.organizationId,
        table.operationKind,
        table.generationAttemptKey,
      )
      .where(sql`${table.generationAttemptKey} is not null`),
    check("ai_processing_runs_locale_check", sql`${table.outputLocale} in ('de', 'en')`),
    check(
      "ai_processing_runs_generation_attempt_check",
      sql`(${table.generationReservationKey} is null and ${table.generationAttemptKey} is null and ${table.durableExecutionAttempt} is null and ${table.providerAttempt} is null) or (${table.generationReservationKey} is not null and ${table.generationAttemptKey} is not null and ${table.durableExecutionAttempt} > 0 and ${table.providerAttempt} > 0)`,
    ),
    check(
      "ai_processing_runs_lifecycle_check",
      sql`(${table.status} = 'succeeded' and ${table.completedAt} is not null and ${table.validatedOutput} is not null and ${table.failureCode} is null) or (${table.status} = 'failed' and ${table.completedAt} is not null and ${table.failureCode} is not null) or (${table.status} in ('pending', 'processing') and ${table.completedAt} is null)`,
    ),
  ],
);

export const legalCorpusFamilies = pgTable.withRLS(
  "legal_corpus_families",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    currentSnapshotId: uuid("current_snapshot_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("legal_corpus_families_code_unique").on(table.code),
    foreignKey({
      name: "legal_corpus_families_current_snapshot_identity_fk",
      columns: [table.id, table.currentSnapshotId],
      foreignColumns: corpusSnapshotIdentity(),
    }).onDelete("restrict"),
  ],
);

export const legalSources = pgTable.withRLS(
  "legal_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => legalCorpusFamilies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    jurisdictionCode: varchar("jurisdiction_code", { length: 2 }).notNull(),
    authorityTier: legalAuthorityTierEnum("authority_tier").notNull(),
    officialSourceUrl: text("official_source_url").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("legal_sources_family_code_unique").on(table.familyId, table.code),
    uniqueIndex("legal_sources_family_id_identity_unique").on(table.familyId, table.id),
  ],
);

export const legalSourceVersions = pgTable.withRLS(
  "legal_source_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    versionLabel: text("version_label").notNull(),
    contentHash: text("content_hash").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "legal_source_versions_source_family_fk",
      columns: [table.familyId, table.sourceId],
      foreignColumns: [legalSources.familyId, legalSources.id],
    }).onDelete("cascade"),
    uniqueIndex("legal_source_versions_source_label_unique").on(
      table.sourceId,
      table.versionLabel,
    ),
    uniqueIndex("legal_source_versions_family_id_identity_unique").on(
      table.familyId,
      table.id,
    ),
    uniqueIndex("legal_source_versions_source_id_identity_unique").on(
      table.sourceId,
      table.id,
    ),
  ],
);

export const legalSourceRenditions = pgTable.withRLS(
  "legal_source_renditions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceVersionId: uuid("source_version_id")
      .notNull()
      .references(() => legalSourceVersions.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 5 }).notNull(),
    translationStatus: legalTranslationStatusEnum("translation_status").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("legal_source_renditions_version_locale_unique").on(
      table.sourceVersionId,
      table.locale,
    ),
    uniqueIndex("legal_source_renditions_storage_unique").on(
      table.storageBucket,
      table.storageKey,
    ),
    check("legal_source_renditions_locale_check", sql`${table.locale} in ('de', 'en')`),
  ],
);

export const legalSourceProcessingGenerations = pgTable.withRLS(
  "legal_source_processing_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceVersionId: uuid("source_version_id")
      .notNull()
      .references(() => legalSourceVersions.id, { onDelete: "cascade" }),
    renditionId: uuid("rendition_id")
      .notNull()
      .references(() => legalSourceRenditions.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => backgroundJobs.id, {
      onDelete: "set null",
    }),
    status: processingStatusEnum("status").default("pending").notNull(),
    parser: text("parser").notNull(),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    // The legal corpus carries no vectors, so the parser is the only
    // processing configuration that distinguishes generations of a rendition.
    uniqueIndex("legal_processing_rendition_config_unique").on(
      table.renditionId,
      table.parser,
    ),
    check(
      "legal_processing_lifecycle_check",
      sql`(${table.status} = 'succeeded' and ${table.completedAt} is not null and ${table.failureCode} is null) or (${table.status} = 'failed' and ${table.completedAt} is not null and ${table.failureCode} is not null) or (${table.status} in ('pending', 'processing') and ${table.completedAt} is null)`,
    ),
  ],
);

export const legalSourceChunks = pgTable.withRLS(
  "legal_source_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    processingGenerationId: uuid("processing_generation_id")
      .notNull()
      .references(() => legalSourceProcessingGenerations.id, {
        onDelete: "cascade",
      }),
    sourceVersionId: uuid("source_version_id")
      .notNull()
      .references(() => legalSourceVersions.id, { onDelete: "cascade" }),
    renditionId: uuid("rendition_id")
      .notNull()
      .references(() => legalSourceRenditions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    pageNumber: integer("page_number"),
    sectionPath: text("section_path"),
    text: text("text").notNull(),
    contentHash: text("content_hash").notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce("text", ''))`,
    ),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("legal_source_chunks_generation_position_unique").on(
      table.processingGenerationId,
      table.position,
    ),
    index("legal_source_chunks_search_idx").using("gin", table.searchVector),
  ],
);


export const legalProvisionChunkBindings = pgTable.withRLS(
  "legal_provision_chunk_bindings",
  {
    stableProvisionKey: text("stable_provision_key").notNull(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => legalSourceChunks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.stableProvisionKey, table.chunkId] }),
    index("legal_provision_chunk_bindings_chunk_idx").on(table.chunkId),
  ],
);

/**
 * Authored best-practice guidance, global rather than per organization.
 *
 * Deliberately much lighter than the legal corpus: no versions, renditions,
 * processing generations, snapshots, authority tiers or translation status.
 * Those exist to prove which law, in which official translation, was in force
 * on a given date. Guidance makes no such claim — it explains what good looks
 * like, so a content hash plus a reviewed binding is the whole provenance
 * requirement.
 *
 * `licence` and `attribution` are not decorative. ENISA material is CC BY 4.0,
 * which permits commercial reuse only with credit, so the terms travel with the
 * content rather than living in a README.
 */
export const guidanceSources = pgTable.withRLS(
  "guidance_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    version: text("version").notNull(),
    url: text("url").notNull(),
    licence: text("licence").notNull(),
    attribution: text("attribution").notNull(),
    language: varchar("language", { length: 5 }).notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("guidance_sources_slug_unique").on(table.slug)],
);

export const guidanceChunks = pgTable.withRLS(
  "guidance_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => guidanceSources.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    sectionPath: text("section_path"),
    text: text("text").notNull(),
    contentHash: text("content_hash").notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce("text", ''))`,
    ),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("guidance_chunks_source_position_unique").on(
      table.sourceId,
      table.position,
    ),
    // Retrieval is binding-driven; this index only backs a later fallback
    // search. `simple` does no stemming, so it will never be the primary path
    // for German queries.
    index("guidance_chunks_search_idx").using("gin", table.searchVector),
  ],
);

/**
 * Reviewed mapping from a legal provision key to a guidance chunk, mirroring
 * `legalProvisionChunkBindings`. Requirements already carry provision keys such
 * as `eu_nis2.article_21_2_e`, so this is what lets guidance reach the right
 * category without inventing a second mapping concept.
 */
export const guidanceProvisionBindings = pgTable.withRLS(
  "guidance_provision_bindings",
  {
    stableProvisionKey: text("stable_provision_key").notNull(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => guidanceChunks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.stableProvisionKey, table.chunkId] }),
    index("guidance_provision_bindings_chunk_idx").on(table.chunkId),
  ],
);

export const legalCorpusSnapshots = pgTable.withRLS(
  "legal_corpus_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => legalCorpusFamilies.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    validatedBy: text("validated_by").notNull(),
    validatedAt: timestamp("validated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("legal_corpus_snapshots_family_hash_unique").on(
      table.familyId,
      table.contentHash,
    ),
    uniqueIndex("legal_corpus_snapshots_family_id_identity_unique").on(
      table.familyId,
      table.id,
    ),
  ],
);

export const legalCorpusSnapshotMembers = pgTable.withRLS(
  "legal_corpus_snapshot_members",
  {
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => legalCorpusSnapshots.id, { onDelete: "cascade" }),
    sourceVersionId: uuid("source_version_id")
      .notNull()
      .references(() => legalSourceVersions.id, { onDelete: "restrict" }),
    renditionId: uuid("rendition_id")
      .notNull()
      .references(() => legalSourceRenditions.id, { onDelete: "restrict" }),
    processingGenerationId: uuid("processing_generation_id")
      .notNull()
      .references(() => legalSourceProcessingGenerations.id, {
        onDelete: "restrict",
      }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.sourceVersionId] }),
    uniqueIndex("legal_corpus_snapshot_members_position_unique").on(
      table.snapshotId,
      table.position,
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

export const gapFindings = pgTable.withRLS(
  "gap_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    outputRevisionId: uuid("output_revision_id").notNull(),
    requirementKey: text("requirement_key").notNull(),
    requirementTitle: text("requirement_title").notNull(),
    requirementText: text("requirement_text").notNull(),
    icon: text("icon").notNull(),
    criticality: text("criticality").notNull(),
    status: gapFindingStatusEnum("status").notNull(),
    summary: text("summary").notNull(),
    guidance: text("guidance").notNull(),
    materialContradiction: boolean("material_contradiction").default(false).notNull(),
    contradictionResolved: boolean("contradiction_resolved").default(false).notNull(),
    sourceChoice: contradictionSourceChoiceEnum("source_choice"),
    resolutionCitationIds: jsonb("resolution_citation_ids").$type<string[]>(),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    originalOutputRevisionId: uuid("original_output_revision_id"),
    originalFindingId: uuid("original_finding_id"),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "gap_findings_output_tenant_fk",
      columns: [table.organizationId, table.outputRevisionId],
      foreignColumns: [
        analysisOutputRevisions.organizationId,
        analysisOutputRevisions.id,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_findings_original_output_tenant_fk",
      columns: [table.organizationId, table.originalOutputRevisionId],
      foreignColumns: [
        analysisOutputRevisions.organizationId,
        analysisOutputRevisions.id,
      ],
    }).onDelete("restrict"),
    uniqueIndex("gap_findings_revision_requirement_unique").on(
      table.outputRevisionId,
      table.requirementKey,
    ),
    uniqueIndex("gap_findings_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    check(
      "gap_findings_criticality_check",
      sql`${table.criticality} in ('low', 'medium', 'high', 'critical')`,
    ),
    check(
      "gap_findings_resolution_check",
      sql`(${table.contradictionResolved} = false and ${table.sourceChoice} is null and ${table.decidedBy} is null and ${table.decidedAt} is null) or (${table.materialContradiction} = true and ${table.contradictionResolved} = true and ${table.sourceChoice} is not null and ${table.decidedBy} is not null and ${table.decidedAt} is not null)`,
    ),
  ],
);

export const gapItems = pgTable.withRLS(
  "gap_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    outputRevisionId: uuid("output_revision_id").notNull(),
    findingId: uuid("finding_id").notNull(),
    stableKey: text("stable_key").notNull(),
    kind: gapItemKindEnum("kind").notNull(),
    statement: text("statement").notNull(),
    recommendation: text("recommendation").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "gap_items_finding_tenant_fk",
      columns: [table.organizationId, table.findingId],
      foreignColumns: [gapFindings.organizationId, gapFindings.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_items_output_tenant_fk",
      columns: [table.organizationId, table.outputRevisionId],
      foreignColumns: [
        analysisOutputRevisions.organizationId,
        analysisOutputRevisions.id,
      ],
    }).onDelete("cascade"),
    uniqueIndex("gap_items_finding_stable_key_unique").on(
      table.findingId,
      table.stableKey,
    ),
    uniqueIndex("gap_items_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
  ],
);

export const gapFindingContextLinks = pgTable.withRLS(
  "gap_finding_context_links",
  {
    organizationId: uuid("organization_id").notNull(),
    findingId: uuid("finding_id").notNull(),
    contextId: uuid("context_id").notNull(),
    relationship: contextLinkRelationshipEnum("relationship")
      .default("supporting")
      .notNull(),
    disposition: contextLinkDispositionEnum("disposition").default("admitted").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.findingId, table.contextId] }),
    foreignKey({
      name: "gap_finding_context_links_finding_tenant_fk",
      columns: [table.organizationId, table.findingId],
      foreignColumns: [gapFindings.organizationId, gapFindings.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_finding_context_links_context_tenant_fk",
      columns: [table.organizationId, table.contextId],
      foreignColumns: [
        aiProcessingRunContext.organizationId,
        aiProcessingRunContext.id,
      ],
    }).onDelete("restrict"),
    index("gap_finding_context_links_relationship_idx").on(
      table.findingId,
      table.relationship,
    ),
  ],
);

export const gapItemContextLinks = pgTable.withRLS(
  "gap_item_context_links",
  {
    organizationId: uuid("organization_id").notNull(),
    gapItemId: uuid("gap_item_id").notNull(),
    contextId: uuid("context_id").notNull(),
    disposition: contextLinkDispositionEnum("disposition").default("admitted").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gapItemId, table.contextId] }),
    foreignKey({
      name: "gap_item_context_links_item_tenant_fk",
      columns: [table.organizationId, table.gapItemId],
      foreignColumns: [gapItems.organizationId, gapItems.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_item_context_links_context_tenant_fk",
      columns: [table.organizationId, table.contextId],
      foreignColumns: [
        aiProcessingRunContext.organizationId,
        aiProcessingRunContext.id,
      ],
    }).onDelete("restrict"),
  ],
);

export const actionPlans = pgTable.withRLS(
  "action_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceGapRevisionId: uuid("source_gap_revision_id").notNull(),
    generationJobId: uuid("generation_job_id").references(() => backgroundJobs.id, {
      onDelete: "restrict",
    }),
    aiProcessingRunId: uuid("ai_processing_run_id").references(
      () => aiProcessingRuns.id,
      { onDelete: "restrict" },
    ),
    locale: varchar("locale", { length: 5 }).notNull(),
    inputHash: text("input_hash").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("action_plans_organization_unique").on(table.organizationId),
    uniqueIndex("action_plans_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "action_plans_gap_revision_tenant_fk",
      columns: [table.organizationId, table.sourceGapRevisionId],
      foreignColumns: [
        analysisOutputRevisions.organizationId,
        analysisOutputRevisions.id,
      ],
    }).onDelete("restrict"),
    check("action_plans_locale_check", sql`${table.locale} in ('de', 'en')`),
  ],
);

export const actionPlanItems = pgTable.withRLS(
  "action_plan_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    actionPlanId: uuid("action_plan_id").notNull(),
    findingId: uuid("finding_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: actionPlanItemStatusEnum("status").default("open").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "action_plan_items_plan_tenant_fk",
      columns: [table.organizationId, table.actionPlanId],
      foreignColumns: [actionPlans.organizationId, actionPlans.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "action_plan_items_finding_tenant_fk",
      columns: [table.organizationId, table.findingId],
      foreignColumns: [gapFindings.organizationId, gapFindings.id],
    }).onDelete("restrict"),
    uniqueIndex("action_plan_items_plan_position_unique").on(
      table.actionPlanId,
      table.position,
    ),
    uniqueIndex("action_plan_items_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
  ],
);

export const actionPlanItemGaps = pgTable.withRLS(
  "action_plan_item_gaps",
  {
    organizationId: uuid("organization_id").notNull(),
    actionPlanId: uuid("action_plan_id").notNull(),
    actionPlanItemId: uuid("action_plan_item_id").notNull(),
    gapItemId: uuid("gap_item_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.actionPlanItemId, table.gapItemId] }),
    foreignKey({
      name: "action_plan_item_gaps_item_tenant_fk",
      columns: [table.organizationId, table.actionPlanItemId],
      foreignColumns: [actionPlanItems.organizationId, actionPlanItems.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "action_plan_item_gaps_gap_tenant_fk",
      columns: [table.organizationId, table.gapItemId],
      foreignColumns: [gapItems.organizationId, gapItems.id],
    }).onDelete("restrict"),
    index("action_plan_item_gaps_gap_idx").on(table.gapItemId),
  ],
);

export const reports = pgTable.withRLS(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    applicabilityRevisionId: uuid("applicability_revision_id").notNull(),
    gapRevisionId: uuid("gap_revision_id").notNull(),
    actionPlanId: uuid("action_plan_id"),
    renderingJobId: uuid("rendering_job_id").notNull().references(
      () => backgroundJobs.id,
      { onDelete: "restrict" },
    ),
    locale: varchar("locale", { length: 5 }).notNull(),
    inputHash: text("input_hash"),
    createdBy: uuid("created_by").notNull(),
    pdfBucket: text("pdf_bucket"),
    pdfKey: text("pdf_key"),
    pdfHash: text("pdf_hash"),
    pdfByteSize: integer("pdf_byte_size"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("reports_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "reports_applicability_revision_tenant_fk",
      columns: [table.organizationId, table.applicabilityRevisionId],
      foreignColumns: [
        analysisOutputRevisions.organizationId,
        analysisOutputRevisions.id,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "reports_gap_revision_tenant_fk",
      columns: [table.organizationId, table.gapRevisionId],
      foreignColumns: [
        analysisOutputRevisions.organizationId,
        analysisOutputRevisions.id,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "reports_action_plan_tenant_fk",
      columns: [table.organizationId, table.actionPlanId],
      foreignColumns: [actionPlans.organizationId, actionPlans.id],
    }).onDelete("restrict"),
    check("reports_locale_check", sql`${table.locale} in ('de', 'en')`),
    check(
      "reports_pdf_locator_check",
      sql`num_nonnulls(${table.inputHash}, ${table.pdfBucket}, ${table.pdfKey}, ${table.pdfHash}, ${table.pdfByteSize}) in (0, 5)`,
    ),
  ],
);

export const reportDocumentSources = pgTable.withRLS(
  "report_document_sources",
  {
    organizationId: uuid("organization_id").notNull(),
    reportId: uuid("report_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reportId, table.documentVersionId] }),
    foreignKey({
      name: "report_document_sources_report_tenant_fk",
      columns: [table.organizationId, table.reportId],
      foreignColumns: [reports.organizationId, reports.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "report_document_sources_document_tenant_fk",
      columns: [table.organizationId, table.documentVersionId],
      foreignColumns: [documentVersions.organizationId, documentVersions.id],
    }).onDelete("restrict"),
  ],
);

export const uploadSessions = pgTable.withRLS(
  "upload_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    state: uploadSessionStateEnum("state").default("pending").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    expectedByteSize: integer("expected_byte_size").notNull(),
    expectedHash: text("expected_hash"),
    resultLocator: jsonb("result_locator"),
    requestedBy: uuid("requested_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("upload_sessions_storage_unique").on(
      table.storageBucket,
      table.storageKey,
    ),
    index("upload_sessions_expiry_idx").on(table.expiresAt),
    check("upload_sessions_size_check", sql`${table.expectedByteSize} > 0`),
  ],
);

export const idempotencyRecords = pgTable.withRLS(
  "idempotency_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    actorKey: text("actor_key").notNull(),
    scope: text("scope").notNull(),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    state: idempotencyStateEnum("state").default("in_progress").notNull(),
    responseStatus: integer("response_status"),
    resultLocator: jsonb("result_locator"),
    errorCode: text("error_code"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idempotency_records_request_unique").on(
      table.actorKey,
      table.scope,
      table.operation,
      table.idempotencyKey,
    ),
    index("idempotency_records_expiry_idx").on(table.expiresAt),
    check(
      "idempotency_records_result_check",
      sql`(${table.state} = 'completed' and ${table.responseStatus} is not null and ${table.resultLocator} is not null) or (${table.state} <> 'completed' and ${table.responseStatus} is null and ${table.resultLocator} is null)`,
    ),
  ],
);

export const apiRateLimitWindows = pgTable.withRLS(
  "api_rate_limit_windows",
  {
    key: text("key").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStartedAt] }),
    index("api_rate_limit_windows_expiry_idx").on(table.expiresAt),
    check("api_rate_limit_windows_count_check", sql`${table.requestCount} >= 0`),
  ],
);

export const auditEvents = pgTable.withRLS(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    requestId: text("request_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "audit_events_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    index("audit_events_organization_time_idx").on(
      table.organizationId,
      table.occurredAt,
    ),
  ],
);

export const platformAuditEvents = pgTable.withRLS(
  "platform_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operatorIdentity: text("operator_identity").notNull(),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    requestId: text("request_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("platform_audit_events_time_idx").on(table.occurredAt)],
);
