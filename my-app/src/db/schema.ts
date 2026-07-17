import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  foreignKey,
  integer,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return value
      .slice(1, -1)
      .split(",")
      .filter(Boolean)
      .map(Number);
  },
});

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "member",
  "auditor",
]);

export const organizationMembershipStatusEnum = pgEnum(
  "organization_membership_status",
  ["active", "suspended"],
);

export const organizationInvitationStatusEnum = pgEnum(
  "organization_invitation_status",
  ["pending", "accepted", "revoked", "expired"],
);

export const organizationFactDataTypeEnum = pgEnum(
  "organization_fact_data_type",
  ["text", "number", "boolean", "enum", "multi_enum", "structured"],
);

export const contentFormatEnum = pgEnum("content_format", [
  "plain_text",
  "markdown",
]);

export const immutableComponentStatusEnum = pgEnum(
  "immutable_component_status",
  ["draft", "published", "retired"],
);

export const complianceCheckReleaseStatusEnum = pgEnum(
  "compliance_check_release_status",
  ["draft", "published", "retired", "superseded"],
);

export const complianceFrameworkVersionStatusEnum = pgEnum(
  "compliance_framework_version_status",
  ["draft", "published", "archived"],
);

export const complianceModuleTypeEnum = pgEnum("compliance_module_type", [
  "questionnaire",
  "generated_artifact",
  "document_analysis",
]);

export const questionAnswerTypeEnum = pgEnum("question_answer_type", [
  "single_choice",
  "multi_choice",
  "text",
  "long_text",
  "number",
  "boolean",
  "date",
  "file",
  "json",
]);

export const assessmentStatusEnum = pgEnum("assessment_status", [
  "active",
  "archived",
]);

export const assessmentRevisionStatusEnum = pgEnum(
  "assessment_revision_status",
  ["draft", "submitted", "superseded", "archived"],
);

export const guestApplicabilityCheckStatusEnum = pgEnum(
  "guest_applicability_check_status",
  ["started", "submitted", "claimed", "deleted", "expired"],
);

export const ruleSetStatusEnum = pgEnum("rule_set_status", [
  "draft",
  "published",
  "archived",
]);

export const generatedArtifactTypeEnum = pgEnum("generated_artifact_type", [
  "affectedness_result",
  "gap_analysis_result",
  "action_plan",
  "document_analysis",
]);

export const generatedArtifactRevisionStatusEnum = pgEnum(
  "generated_artifact_revision_status",
  ["draft", "generated", "reviewed", "approved", "superseded", "archived"],
);

export const generatedArtifactGeneratedByEnum = pgEnum(
  "generated_artifact_generated_by",
  ["system", "ai", "user"],
);

export const artifactRevisionSourceTypeEnum = pgEnum(
  "artifact_revision_source_type",
  [
    "assessment_revision",
    "artifact_revision",
    "document_version",
    "organization_fact_snapshot",
  ],
);

export const gapAnalysisReleaseStatusEnum = pgEnum(
  "gap_analysis_release_status",
  ["draft", "published", "retired", "superseded"],
);

export const gapRequirementCriticalityEnum = pgEnum(
  "gap_requirement_criticality",
  ["low", "medium", "high", "critical"],
);

export const documentStatusEnum = pgEnum("document_status", [
  "active",
  "archived",
]);

export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
]);

export const aiOperationKindEnum = pgEnum("ai_operation_kind", [
  "gap_analysis",
  "live_gap_evaluation",
]);

export const gapFindingStatusEnum = pgEnum("gap_finding_status", [
  "fulfilled",
  "partially_fulfilled",
  "not_fulfilled",
  "insufficient_evidence",
]);

export const evidenceSufficiencyEnum = pgEnum("evidence_sufficiency", [
  "sufficient",
  "partial",
  "none",
]);

export const gapFindingEvidenceSourceTypeEnum = pgEnum(
  "gap_finding_evidence_source_type",
  ["assessment_answer", "document_chunk"],
);

export const actionPlanStatusEnum = pgEnum("action_plan_status", [
  "active",
  "stale",
  "archived",
  "draft_reconciliation",
  "superseded",
]);

export const gapReassessmentStatusEnum = pgEnum("gap_reassessment_status", [
  "open",
  "locked",
  "generated",
  "failed",
  "cancelled",
]);

export const gapReassessmentSelectionOriginEnum = pgEnum(
  "gap_reassessment_selection_origin",
  ["approved_carryover", "version_replacement", "explicit_addition"],
);

export const actionPlanReconciliationStatusEnum = pgEnum(
  "action_plan_reconciliation_status",
  ["draft", "ready", "applied", "cancelled"],
);

export const actionPlanReconciliationChangeKindEnum = pgEnum(
  "action_plan_reconciliation_change_kind",
  [
    "unchanged_gap",
    "new_gap",
    "proposed_closure",
    "effectiveness_not_confirmed",
    "requirement_version_changed",
    "requirement_removed",
  ],
);

export const actionPlanReconciliationDecisionEnum = pgEnum(
  "action_plan_reconciliation_decision",
  ["carry_over", "close", "reopen", "create_follow_up", "keep_legacy", "cancel"],
);

export const actionPlanItemStatusEnum = pgEnum("action_plan_item_status", [
  "open",
  "in_progress",
  "done",
  "cancelled",
]);

export const actionPlanPriorityEnum = pgEnum("action_plan_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    legalName: varchar("legal_name", { length: 255 }),
    country: varchar("country", { length: 2 }).default("DE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("organizations_name_idx").on(table.name),
    index("organizations_country_idx").on(table.country),
  ],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: organizationRoleEnum("role").default("member").notNull(),
    status: organizationMembershipStatusEnum("status")
      .default("active")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "organization_memberships_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    uniqueIndex("organization_memberships_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_memberships_user_idx").on(table.userId),
    index("organization_memberships_org_idx").on(table.organizationId),
    index("organization_memberships_status_idx").on(table.status),
  ],
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: organizationRoleEnum("role").default("member").notNull(),
    invitedByUserId: uuid("invited_by_user_id").notNull(),
    acceptedByUserId: uuid("accepted_by_user_id"),
    tokenHash: text("token_hash").notNull(),
    status: organizationInvitationStatusEnum("status")
      .default("pending")
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "organization_invitations_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    uniqueIndex("organization_invitations_token_hash_unique").on(
      table.tokenHash,
    ),
    index("organization_invitations_org_idx").on(table.organizationId),
    index("organization_invitations_email_idx").on(table.email),
    index("organization_invitations_status_idx").on(table.status),
  ],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stableKey: text("stable_key").notNull(),
    format: contentFormatEnum("format").default("plain_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("content_items_stable_key_unique").on(table.stableKey)],
);

export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentItemId: uuid("content_item_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "content_revisions_item_fk",
      columns: [table.contentItemId],
      foreignColumns: [contentItems.id],
    }).onDelete("restrict"),
    uniqueIndex("content_revisions_item_number_unique").on(
      table.contentItemId,
      table.revisionNumber,
    ),
    uniqueIndex("content_revisions_item_hash_unique").on(
      table.contentItemId,
      table.contentHash,
    ),
  ],
);

export const contentTranslations = pgTable(
  "content_translations",
  {
    contentRevisionId: uuid("content_revision_id").notNull(),
    locale: text("locale").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.contentRevisionId, table.locale] }),
    foreignKey({
      name: "content_translations_revision_fk",
      columns: [table.contentRevisionId],
      foreignColumns: [contentRevisions.id],
    }).onDelete("restrict"),
    index("content_translations_locale_idx").on(table.locale),
  ],
);

export const legalInstruments = pgTable(
  "legal_instruments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    jurisdictionCode: text("jurisdiction_code").notNull(),
    instrumentType: text("instrument_type").notNull(),
  },
  (table) => [uniqueIndex("legal_instruments_code_unique").on(table.code)],
);

export const legalInstrumentVersions = pgTable(
  "legal_instrument_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalInstrumentId: uuid("legal_instrument_id").notNull(),
    versionLabel: text("version_label").notNull(),
    officialIdentifier: text("official_identifier").notNull(),
    officialSourceUrl: text("official_source_url").notNull(),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    titleContentRevisionId: uuid("title_content_revision_id").notNull(),
    contentHash: text("content_hash").notNull(),
  },
  (table) => [
    foreignKey({
      name: "legal_instrument_versions_instrument_fk",
      columns: [table.legalInstrumentId],
      foreignColumns: [legalInstruments.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "legal_instrument_versions_title_content_fk",
      columns: [table.titleContentRevisionId],
      foreignColumns: [contentRevisions.id],
    }).onDelete("restrict"),
    uniqueIndex("legal_instrument_versions_label_unique").on(
      table.legalInstrumentId,
      table.versionLabel,
    ),
    uniqueIndex("legal_instrument_versions_hash_unique").on(table.contentHash),
  ],
);

export const legalProvisions = pgTable(
  "legal_provisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalInstrumentVersionId: uuid("legal_instrument_version_id").notNull(),
    provisionCode: text("provision_code").notNull(),
    officialSourceUrl: text("official_source_url"),
    citationContentRevisionId: uuid("citation_content_revision_id"),
  },
  (table) => [
    foreignKey({
      name: "legal_provisions_instrument_version_fk",
      columns: [table.legalInstrumentVersionId],
      foreignColumns: [legalInstrumentVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "legal_provisions_citation_content_fk",
      columns: [table.citationContentRevisionId],
      foreignColumns: [contentRevisions.id],
    }).onDelete("restrict"),
    uniqueIndex("legal_provisions_version_code_unique").on(
      table.legalInstrumentVersionId,
      table.provisionCode,
    ),
  ],
);

export const scopeModels = pgTable(
  "scope_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
  },
  (table) => [uniqueIndex("scope_models_code_unique").on(table.code)],
);

export const scopeModelVersions = pgTable(
  "scope_model_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeModelId: uuid("scope_model_id").notNull(),
    versionLabel: text("version_label").notNull(),
    status: immutableComponentStatusEnum("status").notNull(),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    contentHash: text("content_hash").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "scope_model_versions_model_fk",
      columns: [table.scopeModelId],
      foreignColumns: [scopeModels.id],
    }).onDelete("restrict"),
    uniqueIndex("scope_model_versions_model_label_unique").on(
      table.scopeModelId,
      table.versionLabel,
    ),
    uniqueIndex("scope_model_versions_hash_unique").on(table.contentHash),
  ],
);

export const scopeSectors = pgTable(
  "scope_sectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
  },
  (table) => [uniqueIndex("scope_sectors_code_unique").on(table.code)],
);

export const scopeSectorVersions = pgTable(
  "scope_sector_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeSectorId: uuid("scope_sector_id").notNull(),
    scopeModelVersionId: uuid("scope_model_version_id").notNull(),
    labelContentRevisionId: uuid("label_content_revision_id").notNull(),
  },
  (table) => [
    foreignKey({ name: "scope_sector_versions_sector_fk", columns: [table.scopeSectorId], foreignColumns: [scopeSectors.id] }).onDelete("restrict"),
    foreignKey({ name: "scope_sector_versions_model_version_fk", columns: [table.scopeModelVersionId], foreignColumns: [scopeModelVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "scope_sector_versions_label_content_fk", columns: [table.labelContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    uniqueIndex("scope_sector_versions_model_sector_unique").on(table.scopeModelVersionId, table.scopeSectorId),
  ],
);

export const scopeEntityTypes = pgTable(
  "scope_entity_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
  },
  (table) => [uniqueIndex("scope_entity_types_code_unique").on(table.code)],
);

export const scopeEntityTypeVersions = pgTable(
  "scope_entity_type_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeEntityTypeId: uuid("scope_entity_type_id").notNull(),
    scopeModelVersionId: uuid("scope_model_version_id").notNull(),
    scopeSectorVersionId: uuid("scope_sector_version_id").notNull(),
    annex: integer("annex"),
    ruleKind: text("rule_kind").notNull(),
    labelContentRevisionId: uuid("label_content_revision_id").notNull(),
    descriptionContentRevisionId: uuid("description_content_revision_id").notNull(),
    definitionHash: text("definition_hash").notNull(),
  },
  (table) => [
    foreignKey({ name: "scope_entity_type_versions_entity_fk", columns: [table.scopeEntityTypeId], foreignColumns: [scopeEntityTypes.id] }).onDelete("restrict"),
    foreignKey({ name: "scope_entity_type_versions_model_fk", columns: [table.scopeModelVersionId], foreignColumns: [scopeModelVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "scope_entity_type_versions_sector_fk", columns: [table.scopeSectorVersionId], foreignColumns: [scopeSectorVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "scope_entity_type_versions_label_fk", columns: [table.labelContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    foreignKey({ name: "scope_entity_type_versions_description_fk", columns: [table.descriptionContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    uniqueIndex("scope_entity_type_versions_model_entity_unique").on(table.scopeModelVersionId, table.scopeEntityTypeId),
    check("scope_entity_type_versions_annex_check", sql`${table.annex} is null or ${table.annex} in (1, 2)`),
  ],
);

export const scopeEntityTypeLegalProvisions = pgTable(
  "scope_entity_type_legal_provisions",
  {
    scopeEntityTypeVersionId: uuid("scope_entity_type_version_id").notNull(),
    legalProvisionId: uuid("legal_provision_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scopeEntityTypeVersionId, table.legalProvisionId] }),
    foreignKey({ name: "scope_entity_type_legal_entity_fk", columns: [table.scopeEntityTypeVersionId], foreignColumns: [scopeEntityTypeVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "scope_entity_type_legal_provision_fk", columns: [table.legalProvisionId], foreignColumns: [legalProvisions.id] }).onDelete("restrict"),
  ],
);

export const organizationFactDefinitions = pgTable(
  "organization_fact_definitions",
  {
    key: text("key").primaryKey(),
    dataType: organizationFactDataTypeEnum("data_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("organization_fact_definitions_data_type_idx").on(table.dataType),
  ],
);

export const organizationFactDefinitionVersions = pgTable(
  "organization_fact_definition_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    factKey: text("fact_key").notNull(),
    versionLabel: text("version_label").notNull(),
    labelContentRevisionId: uuid("label_content_revision_id").notNull(),
    descriptionContentRevisionId: uuid("description_content_revision_id").notNull(),
    contentHash: text("content_hash").notNull(),
  },
  (table) => [
    foreignKey({ name: "organization_fact_definition_versions_fact_fk", columns: [table.factKey], foreignColumns: [organizationFactDefinitions.key] }).onDelete("restrict"),
    foreignKey({ name: "organization_fact_definition_versions_label_fk", columns: [table.labelContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    foreignKey({ name: "organization_fact_definition_versions_description_fk", columns: [table.descriptionContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    uniqueIndex("organization_fact_definition_versions_label_unique").on(table.factKey, table.versionLabel),
    uniqueIndex("organization_fact_definition_versions_hash_unique").on(table.factKey, table.contentHash),
  ],
);

export const factOptions = pgTable(
  "fact_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    factDefinitionKey: text("fact_definition_key").notNull(),
    stableValue: text("stable_value").notNull(),
    catalogCode: text("catalog_code").notNull().default("all"),
    scopeEntityTypeId: uuid("scope_entity_type_id"),
    jurisdictionEntityTypeId: uuid("jurisdiction_entity_type_id").references(
      (): AnyPgColumn => jurisdictionEntityTypes.id,
      { onDelete: "restrict" },
    ),
  },
  (table) => [
    foreignKey({ name: "fact_options_definition_fk", columns: [table.factDefinitionKey], foreignColumns: [organizationFactDefinitions.key] }).onDelete("restrict"),
    foreignKey({ name: "fact_options_entity_type_fk", columns: [table.scopeEntityTypeId], foreignColumns: [scopeEntityTypes.id] }).onDelete("restrict"),
    uniqueIndex("fact_options_definition_value_unique").on(table.factDefinitionKey, table.stableValue),
    check("fact_options_single_catalog_identity_check", sql`num_nonnulls(${table.scopeEntityTypeId}, ${table.jurisdictionEntityTypeId}) <= 1`),
    check("fact_options_catalog_identity_check", sql`(${table.scopeEntityTypeId} is null or ${table.catalogCode} = 'eu_core') and (${table.jurisdictionEntityTypeId} is null or ${table.catalogCode} like 'country:%')`),
  ],
);

export const organizationFactValues = pgTable(
  "organization_fact_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    factKey: text("fact_key").notNull(),
    textValue: text("text_value"),
    numberValue: numeric("number_value"),
    booleanValue: boolean("boolean_value"),
    structuredValue: jsonb("structured_value"),
    sourceType: text("source_type").notNull(),
    sourceRevisionId: uuid("source_revision_id").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    isCurrent: boolean("is_current").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "organization_fact_values_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "organization_fact_values_definition_fk",
      columns: [table.factKey],
      foreignColumns: [organizationFactDefinitions.key],
    }),
    uniqueIndex("organization_fact_values_current_unique")
      .on(table.organizationId, table.factKey)
      .where(sql`${table.isCurrent} = true`),
    index("idx_org_fact_structured_value_gin").using("gin", table.structuredValue),
    index("organization_fact_values_org_idx").on(table.organizationId),
    index("organization_fact_values_fact_key_idx").on(table.factKey),
  ],
);

export const organizationFactValueOptions = pgTable(
  "organization_fact_value_options",
  {
    organizationFactValueId: uuid("organization_fact_value_id").notNull(),
    factOptionId: uuid("fact_option_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationFactValueId, table.factOptionId] }),
    foreignKey({ name: "organization_fact_value_options_value_fk", columns: [table.organizationFactValueId], foreignColumns: [organizationFactValues.id] }).onDelete("cascade"),
    foreignKey({ name: "organization_fact_value_options_option_fk", columns: [table.factOptionId], foreignColumns: [factOptions.id] }).onDelete("restrict"),
    index("organization_fact_value_options_option_idx").on(table.factOptionId),
  ],
);

export const complianceFrameworks = pgTable(
  "compliance_frameworks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("compliance_frameworks_code_unique").on(table.code),
  ],
);

export const complianceFrameworkVersions = pgTable(
  "compliance_framework_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameworkId: uuid("framework_id").notNull(),
    versionLabel: text("version_label").notNull(),
    status: complianceFrameworkVersionStatusEnum("status").notNull(),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "compliance_framework_versions_framework_fk",
      columns: [table.frameworkId],
      foreignColumns: [complianceFrameworks.id],
    }).onDelete("restrict"),
    uniqueIndex("compliance_framework_versions_framework_label_unique").on(
      table.frameworkId,
      table.versionLabel,
    ),
    index("compliance_framework_versions_framework_idx").on(table.frameworkId),
    index("compliance_framework_versions_status_idx").on(table.status),
  ],
);

export const complianceModules = pgTable(
  "compliance_modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    frameworkVersionId: uuid("framework_version_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    moduleType: complianceModuleTypeEnum("module_type").notNull(),
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    foreignKey({
      name: "compliance_modules_framework_version_fk",
      columns: [table.frameworkVersionId],
      foreignColumns: [complianceFrameworkVersions.id],
    }).onDelete("restrict"),
    uniqueIndex("compliance_modules_framework_version_code_unique").on(
      table.frameworkVersionId,
      table.code,
    ),
    index("compliance_modules_framework_version_idx").on(
      table.frameworkVersionId,
    ),
    index("compliance_modules_code_idx").on(table.code),
  ],
);

export const questionnaires = pgTable(
  "questionnaires",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moduleId: uuid("module_id").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "questionnaires_module_fk",
      columns: [table.moduleId],
      foreignColumns: [complianceModules.id],
    }).onDelete("restrict"),
    uniqueIndex("questionnaires_module_code_unique").on(
      table.moduleId,
      table.code,
    ),
    index("questionnaires_module_idx").on(table.moduleId),
    index("questionnaires_code_idx").on(table.code),
  ],
);

export const questionnaireVersions = pgTable(
  "questionnaire_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionnaireId: uuid("questionnaire_id").notNull(),
    versionLabel: text("version_label").notNull(),
    status: complianceFrameworkVersionStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "questionnaire_versions_questionnaire_fk",
      columns: [table.questionnaireId],
      foreignColumns: [questionnaires.id],
    }).onDelete("restrict"),
    uniqueIndex("questionnaire_versions_questionnaire_label_unique").on(
      table.questionnaireId,
      table.versionLabel,
    ),
    index("questionnaire_versions_questionnaire_idx").on(table.questionnaireId),
    index("questionnaire_versions_status_idx").on(table.status),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionnaireVersionId: uuid("questionnaire_version_id").notNull(),
    stableKey: text("stable_key").notNull(),
    position: integer("position").notNull(),
    questionContentRevisionId: uuid("question_content_revision_id").notNull(),
    helpContentRevisionId: uuid("help_content_revision_id"),
    answerType: questionAnswerTypeEnum("answer_type").notNull(),
    required: boolean("required").default(false).notNull(),
    config: jsonb("config").default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "questions_questionnaire_version_fk",
      columns: [table.questionnaireVersionId],
      foreignColumns: [questionnaireVersions.id],
    }).onDelete("restrict"),
    foreignKey({ name: "questions_question_content_fk", columns: [table.questionContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    foreignKey({ name: "questions_help_content_fk", columns: [table.helpContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    uniqueIndex("questions_version_stable_key_unique").on(
      table.questionnaireVersionId,
      table.stableKey,
    ),
    index("questions_questionnaire_version_idx").on(
      table.questionnaireVersionId,
    ),
    index("questions_stable_key_idx").on(table.stableKey),
  ],
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id").notNull(),
    stableValue: text("stable_value").notNull(),
    labelContentRevisionId: uuid("label_content_revision_id").notNull(),
    factOptionId: uuid("fact_option_id"),
    position: integer("position").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  },
  (table) => [
    foreignKey({
      name: "question_options_question_fk",
      columns: [table.questionId],
      foreignColumns: [questions.id],
    }).onDelete("restrict"),
    foreignKey({ name: "question_options_label_content_fk", columns: [table.labelContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    foreignKey({ name: "question_options_fact_option_fk", columns: [table.factOptionId], foreignColumns: [factOptions.id] }).onDelete("restrict"),
    uniqueIndex("question_options_question_value_unique").on(
      table.questionId,
      table.stableValue,
    ),
    index("question_options_question_idx").on(table.questionId),
    index("question_options_fact_option_idx").on(table.factOptionId),
  ],
);

export const questionFactMappings = pgTable(
  "question_fact_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id").notNull(),
    factKey: text("fact_key").notNull(),
    transform: jsonb("transform").default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "question_fact_mappings_question_fk",
      columns: [table.questionId],
      foreignColumns: [questions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "question_fact_mappings_fact_definition_fk",
      columns: [table.factKey],
      foreignColumns: [organizationFactDefinitions.key],
    }),
    uniqueIndex("question_fact_mappings_question_fact_unique").on(
      table.questionId,
      table.factKey,
    ),
    index("question_fact_mappings_question_idx").on(table.questionId),
    index("question_fact_mappings_fact_key_idx").on(table.factKey),
  ],
);

export const scopeThresholdSets = pgTable(
  "scope_threshold_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    versionLabel: text("version_label").notNull(),
    status: immutableComponentStatusEnum("status").notNull(),
    mediumEmployeeThreshold: integer("medium_employee_threshold").notNull(),
    mediumTurnoverThreshold: numeric("medium_turnover_threshold").notNull(),
    mediumBalanceSheetThreshold: numeric("medium_balance_sheet_threshold").notNull(),
    largeEmployeeThreshold: integer("large_employee_threshold").notNull(),
    largeTurnoverThreshold: numeric("large_turnover_threshold").notNull(),
    largeBalanceSheetThreshold: numeric("large_balance_sheet_threshold").notNull(),
    employeeComparison: text("employee_comparison").notNull(),
    financialComparison: text("financial_comparison").notNull(),
    contentHash: text("content_hash").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("scope_threshold_sets_code_version_unique").on(table.code, table.versionLabel),
    uniqueIndex("scope_threshold_sets_hash_unique").on(table.contentHash),
    check("scope_threshold_sets_positive_check", sql`${table.mediumEmployeeThreshold} > 0 and ${table.largeEmployeeThreshold} > ${table.mediumEmployeeThreshold}`),
  ],
);

export const scopeThresholdSetLegalProvisions = pgTable(
  "scope_threshold_set_legal_provisions",
  {
    scopeThresholdSetId: uuid("scope_threshold_set_id").notNull(),
    legalProvisionId: uuid("legal_provision_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scopeThresholdSetId, table.legalProvisionId] }),
    foreignKey({ name: "scope_threshold_legal_set_fk", columns: [table.scopeThresholdSetId], foreignColumns: [scopeThresholdSets.id] }).onDelete("restrict"),
    foreignKey({ name: "scope_threshold_legal_provision_fk", columns: [table.legalProvisionId], foreignColumns: [legalProvisions.id] }).onDelete("restrict"),
  ],
);

export const jurisdictionProfiles = pgTable(
  "jurisdiction_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    countryCode: text("country_code").notNull(),
  },
  (table) => [
    uniqueIndex("jurisdiction_profiles_code_unique").on(table.code),
    uniqueIndex("jurisdiction_profiles_country_unique").on(table.countryCode),
  ],
);

export const jurisdictionProfileVersions = pgTable(
  "jurisdiction_profile_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionProfileId: uuid("jurisdiction_profile_id").notNull(),
    versionLabel: text("version_label").notNull(),
    status: immutableComponentStatusEnum("status").notNull(),
    supported: boolean("supported").notNull(),
    allowNegativeConclusion: boolean("allow_negative_conclusion").notNull(),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    contentHash: text("content_hash").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({ name: "jurisdiction_profile_versions_profile_fk", columns: [table.jurisdictionProfileId], foreignColumns: [jurisdictionProfiles.id] }).onDelete("restrict"),
    uniqueIndex("jurisdiction_profile_versions_label_unique").on(table.jurisdictionProfileId, table.versionLabel),
    uniqueIndex("jurisdiction_profile_versions_hash_unique").on(table.contentHash),
  ],
);

export const jurisdictionEntityTypes = pgTable(
  "jurisdiction_entity_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionProfileId: uuid("jurisdiction_profile_id").notNull(),
    code: text("code").notNull(),
  },
  (table) => [
    foreignKey({ name: "jurisdiction_entity_types_profile_fk", columns: [table.jurisdictionProfileId], foreignColumns: [jurisdictionProfiles.id] }).onDelete("restrict"),
    uniqueIndex("jurisdiction_entity_types_profile_code_unique").on(table.jurisdictionProfileId, table.code),
  ],
);

export const jurisdictionEntityTypeVersions = pgTable(
  "jurisdiction_entity_type_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionEntityTypeId: uuid("jurisdiction_entity_type_id").notNull(),
    jurisdictionProfileVersionId: uuid("jurisdiction_profile_version_id").notNull(),
    statutoryCategoryCode: text("statutory_category_code"),
    annex: integer("annex"),
    classificationRule: text("classification_rule").notNull(),
    labelContentRevisionId: uuid("label_content_revision_id").notNull(),
    descriptionContentRevisionId: uuid("description_content_revision_id").notNull(),
    definitionHash: text("definition_hash").notNull(),
  },
  (table) => [
    foreignKey({ name: "jurisdiction_entity_type_versions_entity_fk", columns: [table.jurisdictionEntityTypeId], foreignColumns: [jurisdictionEntityTypes.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_entity_type_versions_profile_fk", columns: [table.jurisdictionProfileVersionId], foreignColumns: [jurisdictionProfileVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_entity_type_versions_label_fk", columns: [table.labelContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_entity_type_versions_description_fk", columns: [table.descriptionContentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
    uniqueIndex("jurisdiction_entity_type_versions_profile_entity_unique").on(table.jurisdictionProfileVersionId, table.jurisdictionEntityTypeId),
    check("jurisdiction_entity_type_versions_annex_check", sql`${table.annex} is null or ${table.annex} in (1, 2)`),
  ],
);

export const jurisdictionEntityTypeLegalProvisions = pgTable(
  "jurisdiction_entity_type_legal_provisions",
  {
    jurisdictionEntityTypeVersionId: uuid("jurisdiction_entity_type_version_id").notNull(),
    legalProvisionId: uuid("legal_provision_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.jurisdictionEntityTypeVersionId, table.legalProvisionId] }),
    foreignKey({ name: "jurisdiction_entity_type_legal_entity_fk", columns: [table.jurisdictionEntityTypeVersionId], foreignColumns: [jurisdictionEntityTypeVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_entity_type_legal_provision_fk", columns: [table.legalProvisionId], foreignColumns: [legalProvisions.id] }).onDelete("restrict"),
  ],
);

export const jurisdictionEntityTypeMappings = pgTable(
  "jurisdiction_entity_type_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionEntityTypeVersionId: uuid("jurisdiction_entity_type_version_id").notNull(),
    scopeEntityTypeId: uuid("scope_entity_type_id").notNull(),
    relationshipKind: text("relationship_kind").notNull(),
  },
  (table) => [
    foreignKey({ name: "jurisdiction_entity_type_mappings_national_fk", columns: [table.jurisdictionEntityTypeVersionId], foreignColumns: [jurisdictionEntityTypeVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_entity_type_mappings_eu_fk", columns: [table.scopeEntityTypeId], foreignColumns: [scopeEntityTypes.id] }).onDelete("restrict"),
    uniqueIndex("jurisdiction_entity_type_mappings_unique").on(table.jurisdictionEntityTypeVersionId, table.scopeEntityTypeId),
    check("jurisdiction_entity_type_mappings_kind_check", sql`${table.relationshipKind} in ('exact', 'subset', 'aggregate', 'overlap')`),
  ],
);

export const jurisdictionProfileThresholdPolicies = pgTable(
  "jurisdiction_profile_threshold_policies",
  {
    jurisdictionProfileVersionId: uuid("jurisdiction_profile_version_id").primaryKey(),
    scopeThresholdSetId: uuid("scope_threshold_set_id").notNull(),
    employeeMeasure: text("employee_measure").notNull(),
    publicBodyRule: text("public_body_rule").notNull(),
    aggregationRule: text("aggregation_rule").notNull(),
    negligibleActivityRule: text("negligible_activity_rule").notNull(),
  },
  (table) => [
    foreignKey({ name: "jurisdiction_profile_threshold_policy_profile_fk", columns: [table.jurisdictionProfileVersionId], foreignColumns: [jurisdictionProfileVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_profile_threshold_policy_threshold_fk", columns: [table.scopeThresholdSetId], foreignColumns: [scopeThresholdSets.id] }).onDelete("restrict"),
  ],
);

export const jurisdictionProfileJurisdictionRules = pgTable(
  "jurisdiction_profile_jurisdiction_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionProfileVersionId: uuid("jurisdiction_profile_version_id").notNull(),
    jurisdictionEntityTypeId: uuid("jurisdiction_entity_type_id").notNull(),
    basisCode: text("basis_code").notNull(),
    legalProvisionId: uuid("legal_provision_id").notNull(),
    authorityDecisionRequired: boolean("authority_decision_required").default(false).notNull(),
  },
  (table) => [
    foreignKey({ name: "jurisdiction_profile_jurisdiction_rules_profile_fk", columns: [table.jurisdictionProfileVersionId], foreignColumns: [jurisdictionProfileVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_profile_jurisdiction_rules_entity_fk", columns: [table.jurisdictionEntityTypeId], foreignColumns: [jurisdictionEntityTypes.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_profile_jurisdiction_rules_provision_fk", columns: [table.legalProvisionId], foreignColumns: [legalProvisions.id] }).onDelete("restrict"),
    uniqueIndex("jurisdiction_profile_jurisdiction_rules_unique").on(table.jurisdictionProfileVersionId, table.jurisdictionEntityTypeId, table.basisCode),
  ],
);

export const jurisdictionProfileEffectiveStates = pgTable(
  "jurisdiction_profile_effective_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionProfileVersionId: uuid("jurisdiction_profile_version_id").notNull(),
    code: text("code").notNull(),
    stateValue: text("state_value").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    officialSourceUrl: text("official_source_url").notNull(),
    legalProvisionId: uuid("legal_provision_id").notNull(),
    declarationHash: text("declaration_hash").notNull(),
  },
  (table) => [
    foreignKey({ name: "jurisdiction_profile_effective_states_profile_fk", columns: [table.jurisdictionProfileVersionId], foreignColumns: [jurisdictionProfileVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_profile_effective_states_provision_fk", columns: [table.legalProvisionId], foreignColumns: [legalProvisions.id] }).onDelete("restrict"),
    uniqueIndex("jurisdiction_profile_effective_states_code_unique").on(table.jurisdictionProfileVersionId, table.code),
  ],
);

export const jurisdictionProfileLegalProvisions = pgTable(
  "jurisdiction_profile_legal_provisions",
  {
    jurisdictionProfileVersionId: uuid("jurisdiction_profile_version_id").notNull(),
    legalProvisionId: uuid("legal_provision_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.jurisdictionProfileVersionId, table.legalProvisionId] }),
    foreignKey({ name: "jurisdiction_profile_legal_profile_fk", columns: [table.jurisdictionProfileVersionId], foreignColumns: [jurisdictionProfileVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_profile_legal_provision_fk", columns: [table.legalProvisionId], foreignColumns: [legalProvisions.id] }).onDelete("restrict"),
  ],
);

export const jurisdictionProfileDesignations = pgTable(
  "jurisdiction_profile_designations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jurisdictionProfileVersionId: uuid("jurisdiction_profile_version_id").notNull(),
    designationCode: text("designation_code").notNull(),
    outcomeCode: text("outcome_code").notNull(),
    legalProvisionId: uuid("legal_provision_id").notNull(),
  },
  (table) => [
    foreignKey({ name: "jurisdiction_profile_designations_profile_fk", columns: [table.jurisdictionProfileVersionId], foreignColumns: [jurisdictionProfileVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "jurisdiction_profile_designations_provision_fk", columns: [table.legalProvisionId], foreignColumns: [legalProvisions.id] }).onDelete("restrict"),
    uniqueIndex("jurisdiction_profile_designations_code_unique").on(table.jurisdictionProfileVersionId, table.designationCode),
  ],
);

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    moduleId: uuid("module_id").notNull(),
    questionnaireId: uuid("questionnaire_id").notNull(),
    checkReleaseId: uuid("check_release_id").references(
      (): AnyPgColumn => complianceCheckReleases.id,
      {
        onDelete: "restrict",
      },
    ),
    gapAnalysisReleaseId: uuid("gap_analysis_release_id").references(
      (): AnyPgColumn => gapAnalysisReleases.id,
      { onDelete: "restrict" },
    ),
    applicabilityArtifactRevisionId: uuid(
      "applicability_artifact_revision_id",
    ).references((): AnyPgColumn => generatedArtifactRevisions.id, {
      onDelete: "restrict",
    }),
    currentRevisionId: uuid("current_revision_id").references(
      (): AnyPgColumn => assessmentRevisions.id,
    ),
    status: assessmentStatusEnum("status").default("active").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "assessments_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "assessments_module_fk",
      columns: [table.moduleId],
      foreignColumns: [complianceModules.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "assessments_questionnaire_fk",
      columns: [table.questionnaireId],
      foreignColumns: [questionnaires.id],
    }).onDelete("restrict"),
    uniqueIndex("assessments_active_org_module_release_unique")
      .on(table.organizationId, table.moduleId, table.checkReleaseId)
      .where(sql`${table.status} = 'active' AND ${table.checkReleaseId} IS NOT NULL`),
    uniqueIndex("assessments_active_org_module_gap_release_unique")
      .on(table.organizationId, table.moduleId, table.gapAnalysisReleaseId)
      .where(sql`${table.status} = 'active' AND ${table.gapAnalysisReleaseId} IS NOT NULL`),
    check(
      "assessments_release_kind_check",
      sql`(
        ${table.checkReleaseId} IS NOT NULL
        AND ${table.gapAnalysisReleaseId} IS NULL
        AND ${table.applicabilityArtifactRevisionId} IS NULL
      ) OR (
        ${table.checkReleaseId} IS NULL
        AND ${table.gapAnalysisReleaseId} IS NOT NULL
        AND ${table.applicabilityArtifactRevisionId} IS NOT NULL
      )`,
    ),
    index("assessments_organization_idx").on(table.organizationId),
    index("assessments_module_idx").on(table.moduleId),
    index("assessments_current_revision_idx").on(table.currentRevisionId),
    index("assessments_check_release_idx").on(table.checkReleaseId),
    index("assessments_gap_release_idx").on(table.gapAnalysisReleaseId),
    index("assessments_applicability_artifact_idx").on(
      table.applicabilityArtifactRevisionId,
    ),
  ],
);

export const assessmentRevisions = pgTable(
  "assessment_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assessmentId: uuid("assessment_id").notNull(),
    questionnaireVersionId: uuid("questionnaire_version_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    parentRevisionId: uuid("parent_revision_id").references(
      (): AnyPgColumn => assessmentRevisions.id,
    ),
    revertedFromRevisionId: uuid("reverted_from_revision_id").references(
      (): AnyPgColumn => assessmentRevisions.id,
    ),
    status: assessmentRevisionStatusEnum("status").notNull(),
    changeReason: text("change_reason"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "assessment_revisions_assessment_fk",
      columns: [table.assessmentId],
      foreignColumns: [assessments.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "assessment_revisions_questionnaire_version_fk",
      columns: [table.questionnaireVersionId],
      foreignColumns: [questionnaireVersions.id],
    }).onDelete("restrict"),
    uniqueIndex("assessment_revisions_assessment_number_unique").on(
      table.assessmentId,
      table.revisionNumber,
    ),
    index("assessment_revisions_assessment_idx").on(table.assessmentId),
    index("assessment_revisions_status_idx").on(table.status),
  ],
);

export const assessmentAnswers = pgTable(
  "assessment_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assessmentRevisionId: uuid("assessment_revision_id").notNull(),
    questionId: uuid("question_id").notNull(),
    questionStableKey: text("question_stable_key").notNull(),
    textValue: text("text_value"),
    numberValue: numeric("number_value"),
    booleanValue: boolean("boolean_value"),
    dateValue: date("date_value"),
    structuredValue: jsonb("structured_value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "assessment_answers_revision_fk",
      columns: [table.assessmentRevisionId],
      foreignColumns: [assessmentRevisions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "assessment_answers_question_fk",
      columns: [table.questionId],
      foreignColumns: [questions.id],
    }).onDelete("restrict"),
    uniqueIndex("assessment_answers_revision_question_unique").on(
      table.assessmentRevisionId,
      table.questionId,
    ),
    index("idx_answers_revision").on(table.assessmentRevisionId),
    index("idx_answers_stable_key").on(table.questionStableKey),
    index("idx_answers_structured_value_gin").using("gin", table.structuredValue),
  ],
);

export const assessmentAnswerOptions = pgTable(
  "assessment_answer_options",
  {
    assessmentAnswerId: uuid("assessment_answer_id").notNull(),
    questionOptionId: uuid("question_option_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.assessmentAnswerId, table.questionOptionId] }),
    foreignKey({ name: "assessment_answer_options_answer_fk", columns: [table.assessmentAnswerId], foreignColumns: [assessmentAnswers.id] }).onDelete("cascade"),
    foreignKey({ name: "assessment_answer_options_option_fk", columns: [table.questionOptionId], foreignColumns: [questionOptions.id] }).onDelete("restrict"),
    index("assessment_answer_options_option_idx").on(table.questionOptionId),
  ],
);

export const guestApplicabilityChecks = pgTable(
  "guest_applicability_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    status: guestApplicabilityCheckStatusEnum("status")
      .default("started")
      .notNull(),
    checkReleaseId: uuid("check_release_id")
      .notNull()
      .references((): AnyPgColumn => complianceCheckReleases.id, {
        onDelete: "restrict",
      }),
    answers: jsonb("answers"),
    facts: jsonb("facts"),
    result: jsonb("result"),
    inputHash: text("input_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
    claimedByUserId: uuid("claimed_by_user_id"),
    claimedOrganizationId: uuid("claimed_organization_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "guest_applicability_checks_claimed_org_fk",
      columns: [table.claimedOrganizationId],
      foreignColumns: [organizations.id],
    }).onDelete("set null"),
    uniqueIndex("guest_applicability_checks_token_hash_unique").on(
      table.tokenHash,
    ),
    index("guest_applicability_checks_status_idx").on(table.status),
    index("guest_applicability_checks_release_idx").on(table.checkReleaseId),
    index("guest_applicability_checks_expires_at_idx").on(table.expiresAt),
    index("guest_applicability_checks_claimed_user_idx").on(
      table.claimedByUserId,
    ),
  ],
);

export const ruleSets = pgTable(
  "rule_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moduleId: uuid("module_id").notNull(),
    code: text("code").notNull(),
    versionLabel: text("version_label").notNull(),
    status: ruleSetStatusEnum("status").notNull(),
    evaluatorKind: text("evaluator_kind").notNull(),
    evaluatorSchemaVersion: integer("evaluator_schema_version").notNull(),
    rules: jsonb("rules").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "rule_sets_module_fk",
      columns: [table.moduleId],
      foreignColumns: [complianceModules.id],
    }).onDelete("restrict"),
    uniqueIndex("rule_sets_module_code_version_unique").on(
      table.moduleId,
      table.code,
      table.versionLabel,
    ),
    index("rule_sets_module_idx").on(table.moduleId),
    index("rule_sets_status_idx").on(table.status),
    uniqueIndex("rule_sets_content_hash_unique").on(table.contentHash),
  ],
);

export const complianceCheckReleases = pgTable(
  "compliance_check_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    checkCode: text("check_code").notNull(),
    versionLabel: text("version_label").notNull(),
    moduleId: uuid("module_id").notNull(),
    questionnaireVersionId: uuid("questionnaire_version_id").notNull(),
    scopeModelVersionId: uuid("scope_model_version_id").notNull(),
    scopeThresholdSetId: uuid("scope_threshold_set_id").notNull(),
    ruleSetId: uuid("rule_set_id").notNull(),
    evaluatorKind: text("evaluator_kind").notNull(),
    evaluatorVersion: integer("evaluator_version").notNull(),
    defaultLocale: text("default_locale").default("de").notNull(),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    status: complianceCheckReleaseStatusEnum("status").notNull(),
    aggregateHash: text("aggregate_hash").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ name: "compliance_check_releases_module_fk", columns: [table.moduleId], foreignColumns: [complianceModules.id] }).onDelete("restrict"),
    foreignKey({ name: "compliance_check_releases_questionnaire_fk", columns: [table.questionnaireVersionId], foreignColumns: [questionnaireVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "compliance_check_releases_scope_model_fk", columns: [table.scopeModelVersionId], foreignColumns: [scopeModelVersions.id] }).onDelete("restrict"),
    foreignKey({ name: "compliance_check_releases_threshold_fk", columns: [table.scopeThresholdSetId], foreignColumns: [scopeThresholdSets.id] }).onDelete("restrict"),
    foreignKey({ name: "compliance_check_releases_rule_set_fk", columns: [table.ruleSetId], foreignColumns: [ruleSets.id] }).onDelete("restrict"),
    uniqueIndex("compliance_check_releases_check_version_unique").on(table.checkCode, table.versionLabel),
    uniqueIndex("compliance_check_releases_aggregate_hash_unique").on(table.aggregateHash),
    index("compliance_check_releases_status_idx").on(table.status),
  ],
);

export const complianceCheckReleaseProfiles = pgTable(
  "compliance_check_release_profiles",
  {
    checkReleaseId: uuid("check_release_id").notNull(),
    countryCode: text("country_code").notNull(),
    jurisdictionProfileVersionId: uuid("jurisdiction_profile_version_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.checkReleaseId, table.countryCode] }),
    foreignKey({ name: "compliance_check_release_profiles_release_fk", columns: [table.checkReleaseId], foreignColumns: [complianceCheckReleases.id] }).onDelete("restrict"),
    foreignKey({ name: "compliance_check_release_profiles_profile_fk", columns: [table.jurisdictionProfileVersionId], foreignColumns: [jurisdictionProfileVersions.id] }).onDelete("restrict"),
  ],
);

export const complianceCheckReleaseFactVersions = pgTable(
  "compliance_check_release_fact_versions",
  {
    checkReleaseId: uuid("check_release_id").notNull(),
    factDefinitionVersionId: uuid("fact_definition_version_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.checkReleaseId, table.factDefinitionVersionId] }),
    foreignKey({ name: "compliance_check_release_fact_versions_release_fk", columns: [table.checkReleaseId], foreignColumns: [complianceCheckReleases.id] }).onDelete("restrict"),
    foreignKey({ name: "compliance_check_release_fact_versions_fact_fk", columns: [table.factDefinitionVersionId], foreignColumns: [organizationFactDefinitionVersions.id] }).onDelete("restrict"),
  ],
);

export const complianceCheckReleaseContentRevisions = pgTable(
  "compliance_check_release_content_revisions",
  {
    checkReleaseId: uuid("check_release_id").notNull(),
    contentRevisionId: uuid("content_revision_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.checkReleaseId, table.contentRevisionId] }),
    foreignKey({ name: "compliance_release_content_release_fk", columns: [table.checkReleaseId], foreignColumns: [complianceCheckReleases.id] }).onDelete("restrict"),
    foreignKey({ name: "compliance_release_content_revision_fk", columns: [table.contentRevisionId], foreignColumns: [contentRevisions.id] }).onDelete("restrict"),
  ],
);

export const activeComplianceCheckReleases = pgTable(
  "active_compliance_check_releases",
  {
    checkCode: text("check_code").primaryKey(),
    checkReleaseId: uuid("check_release_id").notNull(),
    activatedBy: text("activated_by").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ name: "active_compliance_check_releases_release_fk", columns: [table.checkReleaseId], foreignColumns: [complianceCheckReleases.id] }).onDelete("restrict"),
    uniqueIndex("active_compliance_check_releases_release_unique").on(table.checkReleaseId),
  ],
);

export const complianceCheckReleaseActivations = pgTable(
  "compliance_check_release_activations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    checkCode: text("check_code").notNull(),
    previousReleaseId: uuid("previous_release_id"),
    activatedReleaseId: uuid("activated_release_id").notNull(),
    activatedBy: text("activated_by").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({ name: "compliance_release_activations_previous_fk", columns: [table.previousReleaseId], foreignColumns: [complianceCheckReleases.id] }).onDelete("restrict"),
    foreignKey({ name: "compliance_release_activations_active_fk", columns: [table.activatedReleaseId], foreignColumns: [complianceCheckReleases.id] }).onDelete("restrict"),
    index("compliance_release_activations_check_idx").on(table.checkCode, table.activatedAt),
  ],
);

export const generatedArtifacts = pgTable(
  "generated_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    moduleId: uuid("module_id").notNull(),
    artifactType: generatedArtifactTypeEnum("artifact_type").notNull(),
    currentRevisionId: uuid("current_revision_id").references(
      (): AnyPgColumn => generatedArtifactRevisions.id,
    ),
    acceptedRevisionId: uuid("accepted_revision_id").references(
      (): AnyPgColumn => generatedArtifactRevisions.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "generated_artifacts_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "generated_artifacts_module_fk",
      columns: [table.moduleId],
      foreignColumns: [complianceModules.id],
    }).onDelete("cascade"),
    uniqueIndex("generated_artifacts_org_module_type_unique").on(
      table.organizationId,
      table.moduleId,
      table.artifactType,
    ),
    index("generated_artifacts_organization_idx").on(table.organizationId),
    index("generated_artifacts_module_idx").on(table.moduleId),
    index("generated_artifacts_current_revision_idx").on(
      table.currentRevisionId,
    ),
    index("generated_artifacts_accepted_revision_idx").on(
      table.acceptedRevisionId,
    ),
  ],
);

export const generatedArtifactRevisions = pgTable(
  "generated_artifact_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artifactId: uuid("artifact_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    parentRevisionId: uuid("parent_revision_id").references(
      (): AnyPgColumn => generatedArtifactRevisions.id,
    ),
    revertedFromRevisionId: uuid("reverted_from_revision_id").references(
      (): AnyPgColumn => generatedArtifactRevisions.id,
    ),
    status: generatedArtifactRevisionStatusEnum("status").notNull(),
    result: jsonb("result").notNull(),
    modelName: text("model_name"),
    promptVersion: text("prompt_version"),
    ruleSetId: uuid("rule_set_id"),
    checkReleaseId: uuid("check_release_id"),
    gapAnalysisReleaseId: uuid("gap_analysis_release_id"),
    evaluatorKind: text("evaluator_kind"),
    outcomeCode: text("outcome_code"),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
    inputHash: text("input_hash"),
    generatedBy: generatedArtifactGeneratedByEnum("generated_by")
      .default("system")
      .notNull(),
    createdBy: uuid("created_by"),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "generated_artifact_revisions_artifact_fk",
      columns: [table.artifactId],
      foreignColumns: [generatedArtifacts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "generated_artifact_revisions_rule_set_fk",
      columns: [table.ruleSetId],
      foreignColumns: [ruleSets.id],
    }).onDelete("restrict"),
    foreignKey({ name: "generated_artifact_revisions_release_fk", columns: [table.checkReleaseId], foreignColumns: [complianceCheckReleases.id] }).onDelete("restrict"),
    foreignKey({ name: "generated_artifact_revisions_gap_release_fk", columns: [table.gapAnalysisReleaseId], foreignColumns: [gapAnalysisReleases.id] }).onDelete("restrict"),
    uniqueIndex("generated_artifact_revisions_artifact_number_unique").on(
      table.artifactId,
      table.revisionNumber,
    ),
    index("generated_artifact_revisions_artifact_idx").on(table.artifactId),
    index("generated_artifact_revisions_status_idx").on(table.status),
    index("generated_artifact_revisions_rule_set_idx").on(table.ruleSetId),
    index("generated_artifact_revisions_release_idx").on(table.checkReleaseId),
    index("generated_artifact_revisions_gap_release_idx").on(
      table.gapAnalysisReleaseId,
    ),
    index("generated_artifact_revisions_outcome_idx").on(table.outcomeCode),
    index("generated_artifact_revisions_evaluated_at_idx").on(table.evaluatedAt),
  ],
);

export const nis2ResultProjections = pgTable(
  "nis2_result_projections",
  {
    artifactRevisionId: uuid("artifact_revision_id").primaryKey(),
    countryCode: text("country_code"),
    sizeClassification: text("size_classification").notNull(),
    jurisdictionProfileVersionId: uuid("jurisdiction_profile_version_id"),
  },
  (table) => [
    foreignKey({ name: "nis2_result_projections_artifact_revision_fk", columns: [table.artifactRevisionId], foreignColumns: [generatedArtifactRevisions.id] }).onDelete("cascade"),
    foreignKey({ name: "nis2_result_projections_profile_fk", columns: [table.jurisdictionProfileVersionId], foreignColumns: [jurisdictionProfileVersions.id] }).onDelete("restrict"),
    index("nis2_result_projections_country_idx").on(table.countryCode),
    index("nis2_result_projections_size_idx").on(table.sizeClassification),
  ],
);

export const artifactRevisionSources = pgTable(
  "artifact_revision_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artifactRevisionId: uuid("artifact_revision_id").notNull(),
    sourceType: artifactRevisionSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "artifact_revision_sources_artifact_revision_fk",
      columns: [table.artifactRevisionId],
      foreignColumns: [generatedArtifactRevisions.id],
    }).onDelete("cascade"),
    index("artifact_revision_sources_revision_idx").on(
      table.artifactRevisionId,
    ),
    index("artifact_revision_sources_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const gapRequirementSets = pgTable(
  "gap_requirement_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("gap_requirement_sets_code_unique").on(table.code)],
);

export const gapRequirements = pgTable(
  "gap_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("gap_requirements_code_unique").on(table.code)],
).enableRLS();

export const gapRequirementVersions = pgTable(
  "gap_requirement_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requirementId: uuid("requirement_id").notNull(),
    code: text("code").notNull(),
    versionLabel: text("version_label").notNull(),
    criticality: gapRequirementCriticalityEnum("criticality").notNull(),
    title: jsonb("title").notNull(),
    requirementText: jsonb("requirement_text").notNull(),
    recommendation: jsonb("recommendation").notNull(),
    legalReferences: jsonb("legal_references").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "gap_requirement_versions_requirement_fk",
      columns: [table.requirementId],
      foreignColumns: [gapRequirements.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_requirement_versions_requirement_version_unique").on(
      table.requirementId,
      table.versionLabel,
    ),
    index("gap_requirement_versions_requirement_idx").on(table.requirementId),
    uniqueIndex("gap_requirement_versions_hash_unique").on(table.contentHash),
  ],
);

export const gapRequirementSetVersions = pgTable(
  "gap_requirement_set_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requirementSetId: uuid("requirement_set_id").notNull(),
    versionLabel: text("version_label").notNull(),
    status: immutableComponentStatusEnum("status").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "gap_requirement_set_versions_set_fk",
      columns: [table.requirementSetId],
      foreignColumns: [gapRequirementSets.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_requirement_set_versions_label_unique").on(
      table.requirementSetId,
      table.versionLabel,
    ),
    uniqueIndex("gap_requirement_set_versions_hash_unique").on(
      table.contentHash,
    ),
  ],
);

export const gapRequirementSetMembers = pgTable(
  "gap_requirement_set_members",
  {
    requirementSetVersionId: uuid("requirement_set_version_id").notNull(),
    requirementVersionId: uuid("requirement_version_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.requirementSetVersionId, table.requirementVersionId],
    }),
    foreignKey({
      name: "gap_requirement_set_members_set_version_fk",
      columns: [table.requirementSetVersionId],
      foreignColumns: [gapRequirementSetVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_requirement_set_members_requirement_fk",
      columns: [table.requirementVersionId],
      foreignColumns: [gapRequirementVersions.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_requirement_set_members_position_unique").on(
      table.requirementSetVersionId,
      table.position,
    ),
  ],
);

export const gapAnalysisReleases = pgTable(
  "gap_analysis_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseCode: text("release_code").notNull(),
    versionLabel: text("version_label").notNull(),
    moduleId: uuid("module_id").notNull(),
    questionnaireVersionId: uuid("questionnaire_version_id").notNull(),
    requirementSetVersionId: uuid("requirement_set_version_id").notNull(),
    compatibleCheckReleaseId: uuid("compatible_check_release_id").notNull(),
    promptName: text("prompt_name").notNull(),
    promptVersion: text("prompt_version").notNull(),
    promptTemplateHash: text("prompt_template_hash").notNull(),
    responseSchemaVersion: text("response_schema_version").notNull(),
    evaluatorKind: text("evaluator_kind").notNull(),
    evaluatorVersion: integer("evaluator_version").notNull(),
    modelPolicy: jsonb("model_policy").notNull(),
    defaultLocale: text("default_locale").default("de").notNull(),
    status: gapAnalysisReleaseStatusEnum("status").notNull(),
    aggregateHash: text("aggregate_hash").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "gap_analysis_releases_module_fk",
      columns: [table.moduleId],
      foreignColumns: [complianceModules.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_analysis_releases_questionnaire_fk",
      columns: [table.questionnaireVersionId],
      foreignColumns: [questionnaireVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_analysis_releases_requirement_set_fk",
      columns: [table.requirementSetVersionId],
      foreignColumns: [gapRequirementSetVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_analysis_releases_check_release_fk",
      columns: [table.compatibleCheckReleaseId],
      foreignColumns: [complianceCheckReleases.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_analysis_releases_code_version_unique").on(
      table.releaseCode,
      table.versionLabel,
    ),
    uniqueIndex("gap_analysis_releases_hash_unique").on(table.aggregateHash),
    index("gap_analysis_releases_status_idx").on(table.status),
  ],
);

export const activeGapAnalysisReleases = pgTable(
  "active_gap_analysis_releases",
  {
    releaseCode: text("release_code").primaryKey(),
    gapAnalysisReleaseId: uuid("gap_analysis_release_id").notNull(),
    activatedBy: uuid("activated_by").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "active_gap_analysis_releases_release_fk",
      columns: [table.gapAnalysisReleaseId],
      foreignColumns: [gapAnalysisReleases.id],
    }).onDelete("restrict"),
    uniqueIndex("active_gap_analysis_releases_release_unique").on(
      table.gapAnalysisReleaseId,
    ),
  ],
);

export const gapAnalysisReleaseActivations = pgTable(
  "gap_analysis_release_activations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    releaseCode: text("release_code").notNull(),
    previousReleaseId: uuid("previous_release_id"),
    activatedReleaseId: uuid("activated_release_id").notNull(),
    activatedBy: uuid("activated_by").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "gap_analysis_release_activations_previous_fk",
      columns: [table.previousReleaseId],
      foreignColumns: [gapAnalysisReleases.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_analysis_release_activations_active_fk",
      columns: [table.activatedReleaseId],
      foreignColumns: [gapAnalysisReleases.id],
    }).onDelete("restrict"),
    index("gap_analysis_release_activations_code_idx").on(
      table.releaseCode,
      table.activatedAt,
    ),
  ],
);

export const gapAnalysisReleaseApplicabilityRules = pgTable(
  "gap_analysis_release_applicability_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gapAnalysisReleaseId: uuid("gap_analysis_release_id").notNull(),
    requirementVersionId: uuid("requirement_version_id").notNull(),
    conditions: jsonb("conditions").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "gap_analysis_release_rules_release_fk",
      columns: [table.gapAnalysisReleaseId],
      foreignColumns: [gapAnalysisReleases.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_analysis_release_rules_requirement_fk",
      columns: [table.requirementVersionId],
      foreignColumns: [gapRequirementVersions.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_analysis_release_rules_requirement_unique").on(
      table.gapAnalysisReleaseId,
      table.requirementVersionId,
    ),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    title: text("title").notNull(),
    status: documentStatusEnum("status").default("active").notNull(),
    currentVersionId: uuid("current_version_id").references(
      (): AnyPgColumn => documentVersions.id,
      { onDelete: "restrict" },
    ),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "documents_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    index("documents_organization_idx").on(table.organizationId),
    index("documents_status_idx").on(table.status),
    unique("documents_id_organization_unique").on(
      table.id,
      table.organizationId,
    ),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    contentHash: text("content_hash").notNull(),
    uploadedBy: uuid("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "document_versions_document_fk",
      columns: [table.documentId],
      foreignColumns: [documents.id],
    }).onDelete("restrict"),
    uniqueIndex("document_versions_document_number_unique").on(
      table.documentId,
      table.versionNumber,
    ),
    uniqueIndex("document_versions_storage_path_unique").on(
      table.storageBucket,
      table.storagePath,
    ),
    index("document_versions_document_idx").on(table.documentId),
    index("document_versions_hash_idx").on(table.contentHash),
    unique("document_versions_id_document_unique").on(
      table.id,
      table.documentId,
    ),
    check("document_versions_byte_size_positive", sql`${table.byteSize} > 0`),
  ],
);

export const gapReassessmentDrafts = pgTable(
  "gap_reassessment_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    assessmentId: uuid("assessment_id").notNull(),
    gapAnalysisReleaseId: uuid("gap_analysis_release_id").notNull(),
    baseAcceptedGapRevisionId: uuid("base_accepted_gap_revision_id"),
    assessmentRevisionId: uuid("assessment_revision_id").notNull(),
    status: gapReassessmentStatusEnum("status").default("open").notNull(),
    lockVersion: integer("lock_version").default(1).notNull(),
    aiProcessingRunId: uuid("ai_processing_run_id").references(
      (): AnyPgColumn => aiProcessingRuns.id,
      { onDelete: "restrict" },
    ),
    outputGapRevisionId: uuid("output_gap_revision_id"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "gap_reassessment_drafts_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_reassessment_drafts_assessment_fk",
      columns: [table.assessmentId],
      foreignColumns: [assessments.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_reassessment_drafts_release_fk",
      columns: [table.gapAnalysisReleaseId],
      foreignColumns: [gapAnalysisReleases.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_reassessment_drafts_base_revision_fk",
      columns: [table.baseAcceptedGapRevisionId],
      foreignColumns: [generatedArtifactRevisions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_reassessment_drafts_assessment_revision_fk",
      columns: [table.assessmentRevisionId],
      foreignColumns: [assessmentRevisions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_reassessment_drafts_output_revision_fk",
      columns: [table.outputGapRevisionId],
      foreignColumns: [generatedArtifactRevisions.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_reassessment_drafts_open_assessment_unique")
      .on(table.assessmentId)
      .where(sql`${table.status} = 'open'`),
    unique("gap_reassessment_drafts_id_organization_unique").on(
      table.id,
      table.organizationId,
    ),
    index("gap_reassessment_drafts_organization_idx").on(table.organizationId),
    check("gap_reassessment_drafts_lock_version_positive", sql`${table.lockVersion} > 0`),
  ],
).enableRLS();

export const gapReassessmentDraftDocuments = pgTable(
  "gap_reassessment_draft_documents",
  {
    draftId: uuid("draft_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    documentId: uuid("document_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    selectionOrigin: gapReassessmentSelectionOriginEnum("selection_origin").notNull(),
    selectedBy: uuid("selected_by").notNull(),
    selectedAt: timestamp("selected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.draftId, table.documentVersionId] }),
    foreignKey({
      name: "gap_reassessment_draft_documents_draft_org_fk",
      columns: [table.draftId, table.organizationId],
      foreignColumns: [gapReassessmentDrafts.id, gapReassessmentDrafts.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_reassessment_draft_documents_document_org_fk",
      columns: [table.documentId, table.organizationId],
      foreignColumns: [documents.id, documents.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_reassessment_draft_documents_version_fk",
      columns: [table.documentVersionId, table.documentId],
      foreignColumns: [documentVersions.id, documentVersions.documentId],
    }).onDelete("restrict"),
    index("gap_reassessment_draft_documents_version_idx").on(
      table.documentVersionId,
    ),
  ],
).enableRLS();

export const documentExtractions = pgTable(
  "document_extractions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentVersionId: uuid("document_version_id").notNull(),
    parserKind: text("parser_kind").notNull(),
    parserVersion: text("parser_version").notNull(),
    status: processingStatusEnum("status").notNull(),
    extractedText: text("extracted_text"),
    extractedTextHash: text("extracted_text_hash"),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "document_extractions_version_fk",
      columns: [table.documentVersionId],
      foreignColumns: [documentVersions.id],
    }).onDelete("restrict"),
    uniqueIndex("document_extractions_parser_unique").on(
      table.documentVersionId,
      table.parserKind,
      table.parserVersion,
    ),
    index("document_extractions_status_idx").on(table.status),
  ],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    extractionId: uuid("extraction_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    pageNumber: integer("page_number"),
    sectionLabel: text("section_label"),
    tokenCount: integer("token_count"),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "document_chunks_extraction_fk",
      columns: [table.extractionId],
      foreignColumns: [documentExtractions.id],
    }).onDelete("restrict"),
    uniqueIndex("document_chunks_extraction_index_unique").on(
      table.extractionId,
      table.chunkIndex,
    ),
    index("document_chunks_extraction_idx").on(table.extractionId),
    index("document_chunks_search_idx").using("gin", table.searchVector),
  ],
);

export const documentEmbeddingGenerations = pgTable(
  "document_embedding_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    extractionId: uuid("extraction_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    chunkingVersion: text("chunking_version").notNull(),
    status: processingStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "document_embedding_generations_extraction_fk",
      columns: [table.extractionId],
      foreignColumns: [documentExtractions.id],
    }).onDelete("restrict"),
    uniqueIndex("document_embedding_generations_config_unique").on(
      table.extractionId,
      table.provider,
      table.model,
      table.dimensions,
      table.chunkingVersion,
    ),
    index("document_embedding_generations_status_idx").on(table.status),
    check(
      "document_embedding_generations_dimensions_positive",
      sql`${table.dimensions} > 0`,
    ),
  ],
);

export const documentChunkEmbeddings = pgTable(
  "document_chunk_embeddings",
  {
    generationId: uuid("generation_id").notNull(),
    chunkId: uuid("chunk_id").notNull(),
    embedding: vector("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.generationId, table.chunkId] }),
    foreignKey({
      name: "document_chunk_embeddings_generation_fk",
      columns: [table.generationId],
      foreignColumns: [documentEmbeddingGenerations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "document_chunk_embeddings_chunk_fk",
      columns: [table.chunkId],
      foreignColumns: [documentChunks.id],
    }).onDelete("restrict"),
  ],
);

export const aiProcessingRuns = pgTable(
  "ai_processing_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    assessmentRevisionId: uuid("assessment_revision_id").notNull(),
    operationKind: aiOperationKindEnum("operation_kind").notNull(),
    status: processingStatusEnum("status").default("pending").notNull(),
    inputHash: text("input_hash").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    provider: text("provider"),
    model: text("model"),
    promptName: text("prompt_name").notNull(),
    promptVersion: text("prompt_version").notNull(),
    promptTemplateHash: text("prompt_template_hash").notNull(),
    renderedInputHash: text("rendered_input_hash").notNull(),
    responseSchemaVersion: text("response_schema_version").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    outputArtifactRevisionId: uuid("output_artifact_revision_id").references(
      (): AnyPgColumn => generatedArtifactRevisions.id,
      { onDelete: "restrict" },
    ),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "ai_processing_runs_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "ai_processing_runs_assessment_revision_fk",
      columns: [table.assessmentRevisionId],
      foreignColumns: [assessmentRevisions.id],
    }).onDelete("restrict"),
    uniqueIndex("ai_processing_runs_idempotency_unique").on(
      table.organizationId,
      table.operationKind,
      table.idempotencyKey,
    ),
    index("ai_processing_runs_status_idx").on(table.status),
  ],
);

export const aiProcessingRunInputs = pgTable(
  "ai_processing_run_inputs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    sourceType: artifactRevisionSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceHash: text("source_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_processing_run_inputs_run_fk",
      columns: [table.runId],
      foreignColumns: [aiProcessingRuns.id],
    }).onDelete("cascade"),
    uniqueIndex("ai_processing_run_inputs_source_unique").on(
      table.runId,
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const gapFindings = pgTable(
  "gap_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artifactRevisionId: uuid("artifact_revision_id").notNull(),
    requirementVersionId: uuid("requirement_version_id").notNull(),
    status: gapFindingStatusEnum("status").notNull(),
    evidenceSufficiency: evidenceSufficiencyEnum(
      "evidence_sufficiency",
    ).notNull(),
    severity: actionPlanPriorityEnum("severity").notNull(),
    rationale: jsonb("rationale").notNull(),
    recommendation: jsonb("recommendation").notNull(),
    assumptions: jsonb("assumptions").default(sql`'[]'::jsonb`).notNull(),
    requiresReview: boolean("requires_review").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "gap_findings_artifact_revision_fk",
      columns: [table.artifactRevisionId],
      foreignColumns: [generatedArtifactRevisions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_findings_requirement_fk",
      columns: [table.requirementVersionId],
      foreignColumns: [gapRequirementVersions.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_findings_revision_requirement_unique").on(
      table.artifactRevisionId,
      table.requirementVersionId,
    ),
    index("gap_findings_status_idx").on(table.status),
  ],
);

export const gapFindingEvidence = pgTable(
  "gap_finding_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    findingId: uuid("finding_id").notNull(),
    citationId: text("citation_id").notNull(),
    sourceType: gapFindingEvidenceSourceTypeEnum("source_type").notNull(),
    assessmentAnswerId: uuid("assessment_answer_id"),
    documentChunkId: uuid("document_chunk_id"),
    excerpt: text("excerpt").notNull(),
    pageNumber: integer("page_number"),
    sectionLabel: text("section_label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "gap_finding_evidence_finding_fk",
      columns: [table.findingId],
      foreignColumns: [gapFindings.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_finding_evidence_answer_fk",
      columns: [table.assessmentAnswerId],
      foreignColumns: [assessmentAnswers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "gap_finding_evidence_chunk_fk",
      columns: [table.documentChunkId],
      foreignColumns: [documentChunks.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_finding_evidence_citation_unique").on(
      table.findingId,
      table.citationId,
    ),
    check(
      "gap_finding_evidence_source_check",
      sql`(
        ${table.sourceType} = 'assessment_answer'
        AND ${table.assessmentAnswerId} IS NOT NULL
        AND ${table.documentChunkId} IS NULL
      ) OR (
        ${table.sourceType} = 'document_chunk'
        AND ${table.assessmentAnswerId} IS NULL
        AND ${table.documentChunkId} IS NOT NULL
      )`,
    ),
  ],
);

export const gapFindingReviewResolutions = pgTable(
  "gap_finding_review_resolutions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artifactRevisionId: uuid("artifact_revision_id").notNull(),
    findingId: uuid("finding_id").notNull(),
    reason: text("reason").notNull(),
    resolvedBy: uuid("resolved_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "gap_finding_review_resolutions_revision_fk",
      columns: [table.artifactRevisionId],
      foreignColumns: [generatedArtifactRevisions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "gap_finding_review_resolutions_finding_fk",
      columns: [table.findingId],
      foreignColumns: [gapFindings.id],
    }).onDelete("restrict"),
    uniqueIndex("gap_finding_review_resolutions_finding_unique").on(
      table.artifactRevisionId,
      table.findingId,
    ),
  ],
);

export const actionPlans = pgTable(
  "action_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    sourceGapArtifactRevisionId: uuid(
      "source_gap_artifact_revision_id",
    ).notNull(),
    status: actionPlanStatusEnum("status").default("active").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    predecessorPlanId: uuid("predecessor_plan_id").references(
      (): AnyPgColumn => actionPlans.id,
      { onDelete: "restrict" },
    ),
    activatedBy: uuid("activated_by"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "action_plans_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plans_source_gap_revision_fk",
      columns: [table.sourceGapArtifactRevisionId],
      foreignColumns: [generatedArtifactRevisions.id],
    }).onDelete("restrict"),
    uniqueIndex("action_plans_active_organization_unique")
      .on(table.organizationId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex("action_plans_organization_revision_unique").on(
      table.organizationId,
      table.revisionNumber,
    ),
    unique("action_plans_id_organization_unique").on(
      table.id,
      table.organizationId,
    ),
  ],
);

export const actionPlanItems = pgTable(
  "action_plan_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actionPlanId: uuid("action_plan_id").notNull(),
    sourceFindingId: uuid("source_finding_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    priority: actionPlanPriorityEnum("priority").notNull(),
    status: actionPlanItemStatusEnum("status").default("open").notNull(),
    ownerUserId: uuid("owner_user_id"),
    dueDate: date("due_date"),
    predecessorItemId: uuid("predecessor_item_id").references(
      (): AnyPgColumn => actionPlanItems.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "action_plan_items_plan_fk",
      columns: [table.actionPlanId],
      foreignColumns: [actionPlans.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "action_plan_items_finding_fk",
      columns: [table.sourceFindingId],
      foreignColumns: [gapFindings.id],
    }).onDelete("restrict"),
    uniqueIndex("action_plan_items_finding_unique").on(
      table.actionPlanId,
      table.sourceFindingId,
    ),
    index("action_plan_items_status_idx").on(table.status),
  ],
);

export const actionPlanReconciliations = pgTable(
  "action_plan_reconciliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    sourcePlanId: uuid("source_plan_id").notNull(),
    targetPlanId: uuid("target_plan_id").notNull(),
    sourceGapRevisionId: uuid("source_gap_revision_id").notNull(),
    targetGapRevisionId: uuid("target_gap_revision_id").notNull(),
    sourcePlanUpdatedAt: timestamp("source_plan_updated_at", { withTimezone: true }).notNull(),
    status: actionPlanReconciliationStatusEnum("status").default("draft").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    appliedBy: uuid("applied_by"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "action_plan_reconciliations_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plan_reconciliations_source_plan_org_fk",
      columns: [table.sourcePlanId, table.organizationId],
      foreignColumns: [actionPlans.id, actionPlans.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plan_reconciliations_target_plan_org_fk",
      columns: [table.targetPlanId, table.organizationId],
      foreignColumns: [actionPlans.id, actionPlans.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plan_reconciliations_source_gap_fk",
      columns: [table.sourceGapRevisionId],
      foreignColumns: [generatedArtifactRevisions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plan_reconciliations_target_gap_fk",
      columns: [table.targetGapRevisionId],
      foreignColumns: [generatedArtifactRevisions.id],
    }).onDelete("restrict"),
    uniqueIndex("action_plan_reconciliations_target_plan_unique").on(table.targetPlanId),
    uniqueIndex("action_plan_reconciliations_target_gap_unique")
      .on(table.targetGapRevisionId)
      .where(sql`${table.status} <> 'cancelled'`),
    index("action_plan_reconciliations_organization_idx").on(table.organizationId),
  ],
).enableRLS();

export const actionPlanItemReconciliations = pgTable(
  "action_plan_item_reconciliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reconciliationId: uuid("reconciliation_id").notNull(),
    stableRequirementId: uuid("stable_requirement_id").notNull(),
    previousItemId: uuid("previous_item_id"),
    targetItemId: uuid("target_item_id"),
    previousFindingId: uuid("previous_finding_id"),
    targetFindingId: uuid("target_finding_id"),
    changeKind: actionPlanReconciliationChangeKindEnum("change_kind").notNull(),
    proposedDecision: actionPlanReconciliationDecisionEnum("proposed_decision"),
    decidedDecision: actionPlanReconciliationDecisionEnum("decided_decision"),
    reason: text("reason"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "action_plan_item_reconciliations_reconciliation_fk",
      columns: [table.reconciliationId],
      foreignColumns: [actionPlanReconciliations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "action_plan_item_reconciliations_requirement_fk",
      columns: [table.stableRequirementId],
      foreignColumns: [gapRequirements.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plan_item_reconciliations_previous_item_fk",
      columns: [table.previousItemId],
      foreignColumns: [actionPlanItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plan_item_reconciliations_target_item_fk",
      columns: [table.targetItemId],
      foreignColumns: [actionPlanItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plan_item_reconciliations_previous_finding_fk",
      columns: [table.previousFindingId],
      foreignColumns: [gapFindings.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_plan_item_reconciliations_target_finding_fk",
      columns: [table.targetFindingId],
      foreignColumns: [gapFindings.id],
    }).onDelete("restrict"),
    uniqueIndex("action_plan_item_reconciliations_requirement_unique").on(
      table.reconciliationId,
      table.stableRequirementId,
    ),
  ],
).enableRLS();

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "audit_events_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    index("audit_events_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(organizationMemberships),
  invitations: many(organizationInvitations),
  factValues: many(organizationFactValues),
  assessments: many(assessments),
  generatedArtifacts: many(generatedArtifacts),
}));

export const organizationMembershipsRelations = relations(
  organizationMemberships,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMemberships.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const organizationInvitationsRelations = relations(
  organizationInvitations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvitations.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const organizationFactDefinitionsRelations = relations(
  organizationFactDefinitions,
  ({ many }) => ({
    values: many(organizationFactValues),
    questionMappings: many(questionFactMappings),
  }),
);

export const organizationFactValuesRelations = relations(
  organizationFactValues,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationFactValues.organizationId],
      references: [organizations.id],
    }),
    definition: one(organizationFactDefinitions, {
      fields: [organizationFactValues.factKey],
      references: [organizationFactDefinitions.key],
    }),
  }),
);

export const complianceFrameworksRelations = relations(
  complianceFrameworks,
  ({ many }) => ({
    versions: many(complianceFrameworkVersions),
  }),
);

export const complianceFrameworkVersionsRelations = relations(
  complianceFrameworkVersions,
  ({ one, many }) => ({
    framework: one(complianceFrameworks, {
      fields: [complianceFrameworkVersions.frameworkId],
      references: [complianceFrameworks.id],
    }),
    modules: many(complianceModules),
  }),
);

export const complianceModulesRelations = relations(
  complianceModules,
  ({ one, many }) => ({
    frameworkVersion: one(complianceFrameworkVersions, {
      fields: [complianceModules.frameworkVersionId],
      references: [complianceFrameworkVersions.id],
    }),
    questionnaires: many(questionnaires),
    assessments: many(assessments),
    ruleSets: many(ruleSets),
    generatedArtifacts: many(generatedArtifacts),
  }),
);

export const questionnairesRelations = relations(
  questionnaires,
  ({ one, many }) => ({
    module: one(complianceModules, {
      fields: [questionnaires.moduleId],
      references: [complianceModules.id],
    }),
    versions: many(questionnaireVersions),
    assessments: many(assessments),
  }),
);

export const questionnaireVersionsRelations = relations(
  questionnaireVersions,
  ({ one, many }) => ({
    questionnaire: one(questionnaires, {
      fields: [questionnaireVersions.questionnaireId],
      references: [questionnaires.id],
    }),
    questions: many(questions),
    assessmentRevisions: many(assessmentRevisions),
  }),
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  questionnaireVersion: one(questionnaireVersions, {
    fields: [questions.questionnaireVersionId],
    references: [questionnaireVersions.id],
  }),
  options: many(questionOptions),
  factMappings: many(questionFactMappings),
}));

export const questionOptionsRelations = relations(
  questionOptions,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionOptions.questionId],
      references: [questions.id],
    }),
  }),
);

export const questionFactMappingsRelations = relations(
  questionFactMappings,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionFactMappings.questionId],
      references: [questions.id],
    }),
    factDefinition: one(organizationFactDefinitions, {
      fields: [questionFactMappings.factKey],
      references: [organizationFactDefinitions.key],
    }),
  }),
);

export const assessmentsRelations = relations(
  assessments,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [assessments.organizationId],
      references: [organizations.id],
    }),
    module: one(complianceModules, {
      fields: [assessments.moduleId],
      references: [complianceModules.id],
    }),
    questionnaire: one(questionnaires, {
      fields: [assessments.questionnaireId],
      references: [questionnaires.id],
    }),
    currentRevision: one(assessmentRevisions, {
      fields: [assessments.currentRevisionId],
      references: [assessmentRevisions.id],
    }),
    revisions: many(assessmentRevisions),
  }),
);

export const assessmentRevisionsRelations = relations(
  assessmentRevisions,
  ({ one, many }) => ({
    assessment: one(assessments, {
      fields: [assessmentRevisions.assessmentId],
      references: [assessments.id],
    }),
    questionnaireVersion: one(questionnaireVersions, {
      fields: [assessmentRevisions.questionnaireVersionId],
      references: [questionnaireVersions.id],
    }),
    parentRevision: one(assessmentRevisions, {
      fields: [assessmentRevisions.parentRevisionId],
      references: [assessmentRevisions.id],
    }),
    answers: many(assessmentAnswers),
  }),
);

export const assessmentAnswersRelations = relations(
  assessmentAnswers,
  ({ one }) => ({
    revision: one(assessmentRevisions, {
      fields: [assessmentAnswers.assessmentRevisionId],
      references: [assessmentRevisions.id],
    }),
    question: one(questions, {
      fields: [assessmentAnswers.questionId],
      references: [questions.id],
    }),
  }),
);

export const guestApplicabilityChecksRelations = relations(
  guestApplicabilityChecks,
  ({ one }) => ({
    checkRelease: one(complianceCheckReleases, {
      fields: [guestApplicabilityChecks.checkReleaseId],
      references: [complianceCheckReleases.id],
    }),
    claimedOrganization: one(organizations, {
      fields: [guestApplicabilityChecks.claimedOrganizationId],
      references: [organizations.id],
    }),
  }),
);

export const ruleSetsRelations = relations(ruleSets, ({ one, many }) => ({
  module: one(complianceModules, {
    fields: [ruleSets.moduleId],
    references: [complianceModules.id],
  }),
  generatedArtifactRevisions: many(generatedArtifactRevisions),
}));

export const generatedArtifactsRelations = relations(
  generatedArtifacts,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [generatedArtifacts.organizationId],
      references: [organizations.id],
    }),
    module: one(complianceModules, {
      fields: [generatedArtifacts.moduleId],
      references: [complianceModules.id],
    }),
    currentRevision: one(generatedArtifactRevisions, {
      fields: [generatedArtifacts.currentRevisionId],
      references: [generatedArtifactRevisions.id],
      relationName: "artifact_current_revision",
    }),
    acceptedRevision: one(generatedArtifactRevisions, {
      fields: [generatedArtifacts.acceptedRevisionId],
      references: [generatedArtifactRevisions.id],
      relationName: "artifact_accepted_revision",
    }),
    revisions: many(generatedArtifactRevisions),
  }),
);

export const generatedArtifactRevisionsRelations = relations(
  generatedArtifactRevisions,
  ({ one, many }) => ({
    artifact: one(generatedArtifacts, {
      fields: [generatedArtifactRevisions.artifactId],
      references: [generatedArtifacts.id],
    }),
    ruleSet: one(ruleSets, {
      fields: [generatedArtifactRevisions.ruleSetId],
      references: [ruleSets.id],
    }),
    parentRevision: one(generatedArtifactRevisions, {
      fields: [generatedArtifactRevisions.parentRevisionId],
      references: [generatedArtifactRevisions.id],
    }),
    sources: many(artifactRevisionSources),
  }),
);

export const artifactRevisionSourcesRelations = relations(
  artifactRevisionSources,
  ({ one }) => ({
    artifactRevision: one(generatedArtifactRevisions, {
      fields: [artifactRevisionSources.artifactRevisionId],
      references: [generatedArtifactRevisions.id],
    }),
  }),
);
