import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  foreignKey,
  integer,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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
  ["text", "number", "boolean", "enum", "json"],
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

export const organizationFactDefinitions = pgTable(
  "organization_fact_definitions",
  {
    key: text("key").primaryKey(),
    label: text("label").notNull(),
    dataType: organizationFactDataTypeEnum("data_type").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("organization_fact_definitions_data_type_idx").on(table.dataType)],
);

export const organizationFactValues = pgTable(
  "organization_fact_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    factKey: text("fact_key").notNull(),
    value: jsonb("value").notNull(),
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
    index("idx_org_fact_current")
      .on(table.organizationId, table.factKey)
      .where(sql`${table.isCurrent} = true`),
    index("idx_org_fact_value_gin").using("gin", table.value),
    index("organization_fact_values_org_idx").on(table.organizationId),
    index("organization_fact_values_fact_key_idx").on(table.factKey),
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
    }).onDelete("cascade"),
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
    }).onDelete("cascade"),
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
    }).onDelete("cascade"),
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
    }).onDelete("cascade"),
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
    questionText: text("question_text").notNull(),
    helpText: text("help_text"),
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
    }).onDelete("cascade"),
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
    label: text("label").notNull(),
    position: integer("position").notNull(),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  },
  (table) => [
    foreignKey({
      name: "question_options_question_fk",
      columns: [table.questionId],
      foreignColumns: [questions.id],
    }).onDelete("cascade"),
    uniqueIndex("question_options_question_value_unique").on(
      table.questionId,
      table.stableValue,
    ),
    index("question_options_question_idx").on(table.questionId),
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
    }).onDelete("cascade"),
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

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    moduleId: uuid("module_id").notNull(),
    questionnaireId: uuid("questionnaire_id").notNull(),
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
    }).onDelete("cascade"),
    foreignKey({
      name: "assessments_module_fk",
      columns: [table.moduleId],
      foreignColumns: [complianceModules.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "assessments_questionnaire_fk",
      columns: [table.questionnaireId],
      foreignColumns: [questionnaires.id],
    }).onDelete("cascade"),
    uniqueIndex("assessments_active_org_module_unique")
      .on(table.organizationId, table.moduleId)
      .where(sql`${table.status} = 'active'`),
    index("assessments_organization_idx").on(table.organizationId),
    index("assessments_module_idx").on(table.moduleId),
    index("assessments_current_revision_idx").on(table.currentRevisionId),
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
    }).onDelete("cascade"),
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
    answerValue: jsonb("answer_value").notNull(),
    answerLabel: text("answer_label"),
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
    index("idx_answers_value_gin").using("gin", table.answerValue),
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
    rules: jsonb("rules").notNull(),
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
    }).onDelete("cascade"),
    uniqueIndex("rule_sets_module_code_version_unique").on(
      table.moduleId,
      table.code,
      table.versionLabel,
    ),
    index("rule_sets_module_idx").on(table.moduleId),
    index("rule_sets_status_idx").on(table.status),
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
    inputHash: text("input_hash"),
    generatedBy: generatedArtifactGeneratedByEnum("generated_by")
      .default("system")
      .notNull(),
    createdBy: uuid("created_by"),
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
    }).onDelete("set null"),
    uniqueIndex("generated_artifact_revisions_artifact_number_unique").on(
      table.artifactId,
      table.revisionNumber,
    ),
    index("generated_artifact_revisions_artifact_idx").on(table.artifactId),
    index("generated_artifact_revisions_status_idx").on(table.status),
    index("generated_artifact_revisions_rule_set_idx").on(table.ruleSetId),
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
