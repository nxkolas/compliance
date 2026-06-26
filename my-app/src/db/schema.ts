import { relations, sql } from "drizzle-orm";
import {
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

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(organizationMemberships),
  invitations: many(organizationInvitations),
  factValues: many(organizationFactValues),
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
