import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  customType,
} from "drizzle-orm/pg-core";

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "member",
  "auditor",
]);

export const organizationInvitationStatusEnum = pgEnum(
  "organization_invitation_status",
  ["pending", "accepted", "revoked", "expired"],
);

export const organizationSizeEnum = pgEnum("organization_size", [
  "micro",
  "small",
  "medium",
  "large",
]);

export const nis2EntityCategoryEnum = pgEnum("nis2_entity_category", [
  "not_affected",
  "important",
  "essential",
  "special_case",
  "unknown",
]);

export const nis2SectorCriticalityEnum = pgEnum("nis2_sector_criticality", [
  "annex_1_high_criticality",
  "annex_2_other_criticality",
  "not_listed",
]);

export const assessmentStatusEnum = pgEnum("assessment_status", [
  "draft",
  "in_review",
  "completed",
  "archived",
]);

export const guestAssessmentStatusEnum = pgEnum("guest_assessment_status", [
  "active",
  "claimed",
  "expired",
]);

export const requirementStatusEnum = pgEnum("requirement_status", [
  "not_started",
  "planned",
  "in_progress",
  "implemented",
  "verified",
  "not_applicable",
]);

export const riskLevelEnum = pgEnum("risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const incidentReportStageEnum = pgEnum("incident_report_stage", [
  "early_warning_24h",
  "notification_72h",
  "final_report_1_month",
  "progress_report",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "in_progress",
  "done",
  "blocked",
  "not_applicable",
]);

export const questionnaireTypeEnum = pgEnum("questionnaire_type", [
  "applicability_check",
  "gap_analysis",
]);

export const questionnaireQuestionTypeEnum = pgEnum(
  "questionnaire_question_type",
  ["single_choice", "multi_choice", "number", "money", "boolean", "text", "date"],
);

export const questionnaireResultEnum = pgEnum("questionnaire_result", [
  "unknown",
  "affected",
  "possibly_affected",
  "not_affected",
  "action_required",
  "partially_implemented",
  "baseline_fulfilled",
]);

export const documentReviewStatusEnum = pgEnum("document_review_status", [
  "queued",
  "in_progress",
  "completed",
  "failed",
]);

export const documentFindingStatusEnum = pgEnum("document_finding_status", [
  "present",
  "incomplete",
  "missing",
]);

export const reportExportStatusEnum = pgEnum("report_export_status", [
  "queued",
  "generating",
  "ready",
  "failed",
]);

export const reportExportTypeEnum = pgEnum("report_export_type", [
  "nis2_status_report",
  "management_summary",
  "advisor_package",
  "internal_documentation",
]);

export const reportAudienceEnum = pgEnum("report_audience", [
  "management",
  "external_consultant",
  "internal_documentation",
]);

export const aiMessageRoleEnum = pgEnum("ai_message_role", [
  "system",
  "user",
  "assistant",
]);

export const aiDocumentScopeEnum = pgEnum("ai_document_scope", [
  "organization",
  "reference",
]);

export const aiDocumentStatusEnum = pgEnum("ai_document_status", [
  "processing",
  "ready",
  "failed",
]);

export const aiAssistantModeEnum = pgEnum("ai_assistant_mode", [
  "general_compliance_qa",
  "nis2_gap_analysis",
  "bsig_gap_analysis",
  "document_review",
  "policy_drafting",
  "evidence_mapping",
  "audit_preparation",
  "implementation_checklist",
]);

const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
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

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    legalName: varchar("legal_name", { length: 255 }),
    industryDescription: text("industry_description"),
    employeeCount: integer("employee_count"),
    annualRevenueEur: numeric("annual_revenue_eur", {
      precision: 14,
      scale: 2,
    }),
    balanceSheetTotalEur: numeric("balance_sheet_total_eur", {
      precision: 14,
      scale: 2,
    }),
    size: organizationSizeEnum("size"),
    countryCode: varchar("country_code", { length: 2 }).default("DE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("organizations_name_idx").on(table.name)],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: organizationRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "org_members_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    uniqueIndex("organization_members_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_user_idx").on(table.userId),
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
      name: "org_invitations_org_fk",
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

export const nis2Sectors = pgTable(
  "nis2_sectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    criticality: nis2SectorCriticalityEnum("criticality").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("nis2_sectors_code_unique").on(table.code)],
);

export const organizationSectors = pgTable(
  "organization_sectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    sectorId: uuid("sector_id").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    notes: text("notes"),
  },
  (table) => [
    foreignKey({
      name: "org_sectors_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "org_sectors_sector_fk",
      columns: [table.sectorId],
      foreignColumns: [nis2Sectors.id],
    }).onDelete("restrict"),
    uniqueIndex("organization_sectors_org_sector_unique").on(
      table.organizationId,
      table.sectorId,
    ),
  ],
);

export const nis2CriticalServices = pgTable(
  "nis2_critical_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectorId: uuid("sector_id"),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "nis2_critical_services_sector_fk",
      columns: [table.sectorId],
      foreignColumns: [nis2Sectors.id],
    }).onDelete("set null"),
    uniqueIndex("nis2_critical_services_code_unique").on(table.code),
    index("nis2_critical_services_sector_idx").on(table.sectorId),
  ],
);

export const organizationCriticalServices = pgTable(
  "organization_critical_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    criticalServiceId: uuid("critical_service_id").notNull(),
    isCritical: boolean("is_critical").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "org_critical_services_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "org_critical_services_service_fk",
      columns: [table.criticalServiceId],
      foreignColumns: [nis2CriticalServices.id],
    }).onDelete("restrict"),
    uniqueIndex("org_critical_services_org_service_unique").on(
      table.organizationId,
      table.criticalServiceId,
    ),
    index("org_critical_services_org_idx").on(table.organizationId),
  ],
);

export const lexSpecialisRules = pgTable(
  "lex_specialis_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("lex_specialis_rules_code_unique").on(table.code)],
);

export const selfCheckAssessments = pgTable(
  "self_check_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    title: varchar("title", { length: 255 }).default("NIS2 assessment").notNull(),
    performedByUserId: uuid("performed_by_user_id"),
    status: assessmentStatusEnum("status").default("draft").notNull(),
    category: nis2EntityCategoryEnum("category").default("unknown").notNull(),
    sizeCapApplies: boolean("size_cap_applies"),
    lexSpecialisApplies: boolean("lex_specialis_applies"),
    reasoning: text("reasoning"),
    answers: jsonb("answers").$type<Record<string, unknown>>(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "self_checks_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("self_check_assessments_org_idx").on(table.organizationId),
    index("self_check_assessments_status_idx").on(table.status),
  ],
);

export const assessmentLexSpecialisMatches = pgTable(
  "assessment_lex_specialis_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assessmentId: uuid("assessment_id").notNull(),
    ruleId: uuid("rule_id").notNull(),
    notes: text("notes"),
  },
  (table) => [
    foreignKey({
      name: "assessment_lex_assessment_fk",
      columns: [table.assessmentId],
      foreignColumns: [selfCheckAssessments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "assessment_lex_rule_fk",
      columns: [table.ruleId],
      foreignColumns: [lexSpecialisRules.id],
    }).onDelete("restrict"),
    uniqueIndex("assessment_lex_specialis_unique").on(
      table.assessmentId,
      table.ruleId,
    ),
  ],
);

export const guestAssessmentSessions = pgTable(
  "guest_assessment_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    assessmentId: uuid("assessment_id").notNull(),
    anonymousUserId: uuid("anonymous_user_id").notNull(),
    status: guestAssessmentStatusEnum("status").default("active").notNull(),
    claimTokenHash: text("claim_token_hash").notNull(),
    claimedByUserId: uuid("claimed_by_user_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "guest_assessment_sessions_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "guest_assessment_sessions_assessment_fk",
      columns: [table.assessmentId],
      foreignColumns: [selfCheckAssessments.id],
    }).onDelete("cascade"),
    uniqueIndex("guest_assessment_sessions_assessment_unique").on(
      table.assessmentId,
    ),
    uniqueIndex("guest_assessment_sessions_token_unique").on(
      table.claimTokenHash,
    ),
    index("guest_assessment_sessions_user_idx").on(table.anonymousUserId),
    index("guest_assessment_sessions_expiry_idx").on(table.expiresAt),
    index("guest_assessment_sessions_status_idx").on(table.status),
  ],
);

export const guestCreationRateLimits = pgTable(
  "guest_creation_rate_limits",
  {
    identifierHash: varchar("identifier_hash", { length: 64 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").default(1).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("guest_creation_rate_limits_window_unique").on(
      table.identifierHash,
      table.windowStart,
    ),
    index("guest_creation_rate_limits_expiry_idx").on(table.expiresAt),
  ],
);

export const questionnaireTemplates = pgTable(
  "questionnaire_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    type: questionnaireTypeEnum("type").notNull(),
    version: varchar("version", { length: 32 }).default("1").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("questionnaire_templates_code_version_unique").on(
      table.code,
      table.version,
    ),
    index("questionnaire_templates_type_idx").on(table.type),
    index("questionnaire_templates_active_idx").on(table.isActive),
  ],
);

export const questionnaireSections = pgTable(
  "questionnaire_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id").notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    foreignKey({
      name: "questionnaire_sections_template_fk",
      columns: [table.templateId],
      foreignColumns: [questionnaireTemplates.id],
    }).onDelete("cascade"),
    uniqueIndex("questionnaire_sections_template_code_unique").on(
      table.templateId,
      table.code,
    ),
    index("questionnaire_sections_template_idx").on(table.templateId),
  ],
);

export const questionnaireQuestions = pgTable(
  "questionnaire_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectionId: uuid("section_id").notNull(),
    code: varchar("code", { length: 96 }).notNull(),
    prompt: text("prompt").notNull(),
    helpText: text("help_text"),
    questionType: questionnaireQuestionTypeEnum("question_type").notNull(),
    isRequired: boolean("is_required").default(true).notNull(),
    options: jsonb("options").$type<Record<string, unknown>[]>(),
    scoring: jsonb("scoring").$type<Record<string, unknown>>(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    foreignKey({
      name: "questionnaire_questions_section_fk",
      columns: [table.sectionId],
      foreignColumns: [questionnaireSections.id],
    }).onDelete("cascade"),
    uniqueIndex("questionnaire_questions_section_code_unique").on(
      table.sectionId,
      table.code,
    ),
    index("questionnaire_questions_section_idx").on(table.sectionId),
  ],
);

export const questionnaireRuns = pgTable(
  "questionnaire_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    templateId: uuid("template_id").notNull(),
    selfCheckAssessmentId: uuid("self_check_assessment_id"),
    performedByUserId: uuid("performed_by_user_id"),
    status: assessmentStatusEnum("status").default("draft").notNull(),
    result: questionnaireResultEnum("result").default("unknown").notNull(),
    progress: integer("progress").default(0).notNull(),
    score: numeric("score", { precision: 6, scale: 2 }),
    summary: text("summary"),
    reasoning: text("reasoning"),
    answersSnapshot: jsonb("answers_snapshot").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "questionnaire_runs_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "questionnaire_runs_template_fk",
      columns: [table.templateId],
      foreignColumns: [questionnaireTemplates.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "questionnaire_runs_self_check_fk",
      columns: [table.selfCheckAssessmentId],
      foreignColumns: [selfCheckAssessments.id],
    }).onDelete("set null"),
    index("questionnaire_runs_org_idx").on(table.organizationId),
    index("questionnaire_runs_template_idx").on(table.templateId),
    index("questionnaire_runs_status_idx").on(table.status),
    index("questionnaire_runs_result_idx").on(table.result),
    uniqueIndex("questionnaire_runs_self_check_unique").on(
      table.selfCheckAssessmentId,
    ),
  ],
);

export const questionnaireAnswers = pgTable(
  "questionnaire_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    questionId: uuid("question_id").notNull(),
    value: jsonb("value").$type<Record<string, unknown> | unknown[]>(),
    notes: text("notes"),
    answeredByUserId: uuid("answered_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "questionnaire_answers_run_fk",
      columns: [table.runId],
      foreignColumns: [questionnaireRuns.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "questionnaire_answers_question_fk",
      columns: [table.questionId],
      foreignColumns: [questionnaireQuestions.id],
    }).onDelete("restrict"),
    uniqueIndex("questionnaire_answers_run_question_unique").on(
      table.runId,
      table.questionId,
    ),
    index("questionnaire_answers_run_idx").on(table.runId),
  ],
);

export const tomAreas = pgTable(
  "tom_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bsigNumber: integer("bsig_number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
  },
  (table) => [uniqueIndex("tom_areas_bsig_number_unique").on(table.bsigNumber)],
);

export const organizationRequirements = pgTable(
  "organization_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    tomAreaId: uuid("tom_area_id").notNull(),
    status: requirementStatusEnum("status").default("not_started").notNull(),
    riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
    ownerUserId: uuid("owner_user_id"),
    currentState: text("current_state"),
    targetState: text("target_state"),
    evidenceSummary: text("evidence_summary"),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "org_requirements_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "org_requirements_tom_fk",
      columns: [table.tomAreaId],
      foreignColumns: [tomAreas.id],
    }).onDelete("restrict"),
    uniqueIndex("organization_requirements_org_tom_unique").on(
      table.organizationId,
      table.tomAreaId,
    ),
    index("organization_requirements_status_idx").on(table.status),
  ],
);

export const requirementEvidence = pgTable(
  "requirement_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requirementId: uuid("requirement_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    filePath: text("file_path"),
    externalUrl: text("external_url"),
    uploadedByUserId: uuid("uploaded_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "req_evidence_requirement_fk",
      columns: [table.requirementId],
      foreignColumns: [organizationRequirements.id],
    }).onDelete("cascade"),
    index("requirement_evidence_requirement_idx").on(table.requirementId),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }),
    serviceDescription: text("service_description"),
    isCritical: boolean("is_critical").default(false).notNull(),
    riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "suppliers_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("suppliers_org_idx").on(table.organizationId),
    index("suppliers_risk_level_idx").on(table.riskLevel),
  ],
);

export const supplierAssessments = pgTable(
  "supplier_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id").notNull(),
    performedByUserId: uuid("performed_by_user_id"),
    status: assessmentStatusEnum("status").default("draft").notNull(),
    riskLevel: riskLevelEnum("risk_level").default("medium").notNull(),
    answers: jsonb("answers").$type<Record<string, unknown>>(),
    summary: text("summary"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "supplier_assessments_supplier_fk",
      columns: [table.supplierId],
      foreignColumns: [suppliers.id],
    }).onDelete("cascade"),
    index("supplier_assessments_supplier_idx").on(table.supplierId),
  ],
);

export const registrationTasks = pgTable(
  "registration_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    authority: varchar("authority", { length: 120 }).notNull(),
    status: taskStatusEnum("status").default("open").notNull(),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "registration_tasks_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("registration_tasks_org_idx").on(table.organizationId),
    index("registration_tasks_status_idx").on(table.status),
  ],
);

export const securityIncidents = pgTable(
  "security_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    severity: riskLevelEnum("severity").default("medium").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "security_incidents_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("security_incidents_org_idx").on(table.organizationId),
    index("security_incidents_severity_idx").on(table.severity),
  ],
);

export const incidentReports = pgTable(
  "incident_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id").notNull(),
    stage: incidentReportStageEnum("stage").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedByUserId: uuid("submitted_by_user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "incident_reports_incident_fk",
      columns: [table.incidentId],
      foreignColumns: [securityIncidents.id],
    }).onDelete("cascade"),
    uniqueIndex("incident_reports_incident_stage_unique").on(
      table.incidentId,
      table.stage,
    ),
  ],
);

export const managementTrainings = pgTable(
  "management_trainings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    managerUserId: uuid("manager_user_id"),
    title: varchar("title", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }),
    completedOn: date("completed_on").notNull(),
    validUntil: date("valid_until"),
    evidencePath: text("evidence_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "management_trainings_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("management_trainings_org_idx").on(table.organizationId),
  ],
);

export const aiChats = pgTable(
  "ai_chats",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    assistantMode: aiAssistantModeEnum("assistant_mode")
      .default("general_compliance_qa")
      .notNull(),
    lastSummaryId: uuid("last_summary_id"),
    title: varchar("title", { length: 255 }).default("Compliance assistant").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_chats_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("ai_chats_org_idx").on(table.organizationId),
    index("ai_chats_created_by_idx").on(table.createdByUserId),
  ],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uiMessageId: varchar("ui_message_id", { length: 128 }).notNull(),
    chatId: uuid("chat_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    role: aiMessageRoleEnum("role").notNull(),
    assistantMode: aiAssistantModeEnum("assistant_mode"),
    promptName: varchar("prompt_name", { length: 120 }),
    promptVersion: varchar("prompt_version", { length: 64 }),
    promptHash: varchar("prompt_hash", { length: 64 }),
    modelProvider: varchar("model_provider", { length: 64 }),
    modelId: varchar("model_id", { length: 255 }),
    retrievedChunkIds: jsonb("retrieved_chunk_ids").$type<string[]>(),
    generatedCitationIds: jsonb("generated_citation_ids").$type<string[]>(),
    responseContract: jsonb("response_contract").$type<Record<string, unknown>>(),
    validationWarnings: jsonb("validation_warnings").$type<string[]>(),
    parts: jsonb("parts").$type<Record<string, unknown>[]>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_messages_chat_fk",
      columns: [table.chatId],
      foreignColumns: [aiChats.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_messages_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("ai_messages_chat_idx").on(table.chatId),
    index("ai_messages_org_idx").on(table.organizationId),
    uniqueIndex("ai_messages_chat_ui_message_unique").on(
      table.chatId,
      table.uiMessageId,
    ),
  ],
);

export const aiDocuments = pgTable(
  "ai_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id"),
    chatId: uuid("chat_id"),
    uiMessageId: varchar("ui_message_id", { length: 128 }),
    scope: aiDocumentScopeEnum("scope").notNull(),
    status: aiDocumentStatusEnum("status").default("processing").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    sourceUrl: text("source_url"),
    storagePath: text("storage_path"),
    mimeType: varchar("mime_type", { length: 120 }),
    checksum: varchar("checksum", { length: 64 }),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_documents_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_documents_chat_fk",
      columns: [table.chatId],
      foreignColumns: [aiChats.id],
    }).onDelete("cascade"),
    index("ai_documents_org_idx").on(table.organizationId),
    index("ai_documents_chat_idx").on(table.chatId),
    index("ai_documents_ui_message_idx").on(table.uiMessageId),
    index("ai_documents_scope_idx").on(table.scope),
    index("ai_documents_status_idx").on(table.status),
  ],
);

export const aiDocumentChunks = pgTable(
  "ai_document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull(),
    organizationId: uuid("organization_id"),
    chatId: uuid("chat_id"),
    uiMessageId: varchar("ui_message_id", { length: 128 }),
    scope: aiDocumentScopeEnum("scope").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenEstimate: integer("token_estimate").notNull(),
    embedding: vector("embedding", {
      dimensions: Number(process.env.AI_EMBEDDING_DIM ?? 1536),
    }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_document_chunks_document_fk",
      columns: [table.documentId],
      foreignColumns: [aiDocuments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_document_chunks_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_document_chunks_chat_fk",
      columns: [table.chatId],
      foreignColumns: [aiChats.id],
    }).onDelete("cascade"),
    index("ai_document_chunks_document_idx").on(table.documentId),
    index("ai_document_chunks_org_idx").on(table.organizationId),
    index("ai_document_chunks_chat_idx").on(table.chatId),
    index("ai_document_chunks_ui_message_idx").on(table.uiMessageId),
    index("ai_document_chunks_scope_idx").on(table.scope),
  ],
);

export const documentRequirementTypes = pgTable(
  "document_requirement_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 120 }),
    isRequired: boolean("is_required").default(true).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("document_requirement_types_code_unique").on(table.code),
    index("document_requirement_types_active_idx").on(table.isActive),
  ],
);

export const documentReviewRuns = pgTable(
  "document_review_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    documentId: uuid("document_id"),
    chatId: uuid("chat_id"),
    performedByUserId: uuid("performed_by_user_id"),
    status: documentReviewStatusEnum("status").default("queued").notNull(),
    summary: text("summary"),
    modelProvider: varchar("model_provider", { length: 64 }),
    modelId: varchar("model_id", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "document_review_runs_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "document_review_runs_document_fk",
      columns: [table.documentId],
      foreignColumns: [aiDocuments.id],
    }).onDelete("set null"),
    foreignKey({
      name: "document_review_runs_chat_fk",
      columns: [table.chatId],
      foreignColumns: [aiChats.id],
    }).onDelete("set null"),
    index("document_review_runs_org_idx").on(table.organizationId),
    index("document_review_runs_document_idx").on(table.documentId),
    index("document_review_runs_status_idx").on(table.status),
  ],
);

export const documentReviewFindings = pgTable(
  "document_review_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewRunId: uuid("review_run_id").notNull(),
    requirementTypeId: uuid("requirement_type_id").notNull(),
    documentId: uuid("document_id"),
    status: documentFindingStatusEnum("status").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    evidenceSummary: text("evidence_summary"),
    recommendation: text("recommendation"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    citedChunkIds: jsonb("cited_chunk_ids").$type<string[]>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "document_review_findings_run_fk",
      columns: [table.reviewRunId],
      foreignColumns: [documentReviewRuns.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "document_review_findings_requirement_fk",
      columns: [table.requirementTypeId],
      foreignColumns: [documentRequirementTypes.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "document_review_findings_document_fk",
      columns: [table.documentId],
      foreignColumns: [aiDocuments.id],
    }).onDelete("set null"),
    index("document_review_findings_run_idx").on(table.reviewRunId),
    index("document_review_findings_requirement_idx").on(
      table.requirementTypeId,
    ),
    index("document_review_findings_status_idx").on(table.status),
  ],
);

export const actionPlanItems = pgTable(
  "action_plan_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    requirementId: uuid("requirement_id"),
    questionnaireRunId: uuid("questionnaire_run_id"),
    documentReviewFindingId: uuid("document_review_finding_id"),
    documentId: uuid("document_id"),
    ownerUserId: uuid("owner_user_id"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    priority: riskLevelEnum("priority").default("medium").notNull(),
    status: taskStatusEnum("status").default("open").notNull(),
    progress: integer("progress").default(0).notNull(),
    source: varchar("source", { length: 120 }),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "action_plan_items_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "action_plan_items_requirement_fk",
      columns: [table.requirementId],
      foreignColumns: [organizationRequirements.id],
    }).onDelete("set null"),
    foreignKey({
      name: "action_plan_items_questionnaire_run_fk",
      columns: [table.questionnaireRunId],
      foreignColumns: [questionnaireRuns.id],
    }).onDelete("set null"),
    foreignKey({
      name: "action_plan_items_document_finding_fk",
      columns: [table.documentReviewFindingId],
      foreignColumns: [documentReviewFindings.id],
    }).onDelete("set null"),
    foreignKey({
      name: "action_plan_items_document_fk",
      columns: [table.documentId],
      foreignColumns: [aiDocuments.id],
    }).onDelete("set null"),
    index("action_plan_items_org_idx").on(table.organizationId),
    index("action_plan_items_status_idx").on(table.status),
    index("action_plan_items_priority_idx").on(table.priority),
    index("action_plan_items_due_date_idx").on(table.dueDate),
  ],
);

export const reportExports = pgTable(
  "report_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    generatedByUserId: uuid("generated_by_user_id"),
    exportType: reportExportTypeEnum("export_type")
      .default("nis2_status_report")
      .notNull(),
    audience: reportAudienceEnum("audience").notNull(),
    status: reportExportStatusEnum("status").default("queued").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    storagePath: text("storage_path"),
    includedSections: jsonb("included_sections").$type<string[]>(),
    summarySnapshot: jsonb("summary_snapshot").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "report_exports_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("report_exports_org_idx").on(table.organizationId),
    index("report_exports_status_idx").on(table.status),
    index("report_exports_audience_idx").on(table.audience),
  ],
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    language: varchar("language", { length: 12 }).default("de").notNull(),
    notificationSettings: jsonb("notification_settings").$type<
      Record<string, unknown>
    >(),
    privacySettings: jsonb("privacy_settings").$type<Record<string, unknown>>(),
    uiSettings: jsonb("ui_settings").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_preferences_user_unique").on(table.userId),
    index("user_preferences_language_idx").on(table.language),
  ],
);

export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    notificationSettings: jsonb("notification_settings").$type<
      Record<string, unknown>
    >(),
    privacySettings: jsonb("privacy_settings").$type<Record<string, unknown>>(),
    complianceSettings: jsonb("compliance_settings").$type<
      Record<string, unknown>
    >(),
    dataRetentionDays: integer("data_retention_days"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "organization_settings_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    uniqueIndex("organization_settings_org_unique").on(table.organizationId),
  ],
);

export const aiPromptVersions = pgTable(
  "ai_prompt_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promptName: varchar("prompt_name", { length: 120 }).notNull(),
    promptVersion: varchar("prompt_version", { length: 64 }).notNull(),
    promptHash: varchar("prompt_hash", { length: 64 }).notNull(),
    assistantMode: aiAssistantModeEnum("assistant_mode").notNull(),
    template: text("template").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("ai_prompt_versions_name_version_unique").on(
      table.promptName,
      table.promptVersion,
    ),
    index("ai_prompt_versions_mode_idx").on(table.assistantMode),
    index("ai_prompt_versions_hash_idx").on(table.promptHash),
  ],
);

export const aiChatSummaries = pgTable(
  "ai_chat_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    summary: text("summary").notNull(),
    coveredMessageCount: integer("covered_message_count").notNull(),
    lastCoveredMessageId: uuid("last_covered_message_id"),
    modelProvider: varchar("model_provider", { length: 64 }),
    modelId: varchar("model_id", { length: 255 }),
    promptName: varchar("prompt_name", { length: 120 }),
    promptVersion: varchar("prompt_version", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_chat_summaries_chat_fk",
      columns: [table.chatId],
      foreignColumns: [aiChats.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_chat_summaries_org_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "ai_chat_summaries_last_message_fk",
      columns: [table.lastCoveredMessageId],
      foreignColumns: [aiMessages.id],
    }).onDelete("set null"),
    index("ai_chat_summaries_chat_idx").on(table.chatId),
    index("ai_chat_summaries_org_idx").on(table.organizationId),
  ],
);

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  invitations: many(organizationInvitations),
  sectors: many(organizationSectors),
  criticalServices: many(organizationCriticalServices),
  selfCheckAssessments: many(selfCheckAssessments),
  questionnaireRuns: many(questionnaireRuns),
  requirements: many(organizationRequirements),
  suppliers: many(suppliers),
  registrationTasks: many(registrationTasks),
  securityIncidents: many(securityIncidents),
  managementTrainings: many(managementTrainings),
  aiChats: many(aiChats),
  aiDocuments: many(aiDocuments),
  documentReviewRuns: many(documentReviewRuns),
  actionPlanItems: many(actionPlanItems),
  reportExports: many(reportExports),
  guestAssessmentSessions: many(guestAssessmentSessions),
  settings: one(organizationSettings),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
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

export const nis2SectorsRelations = relations(nis2Sectors, ({ many }) => ({
  organizations: many(organizationSectors),
  criticalServices: many(nis2CriticalServices),
}));

export const organizationSectorsRelations = relations(
  organizationSectors,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSectors.organizationId],
      references: [organizations.id],
    }),
    sector: one(nis2Sectors, {
      fields: [organizationSectors.sectorId],
      references: [nis2Sectors.id],
    }),
  }),
);

export const nis2CriticalServicesRelations = relations(
  nis2CriticalServices,
  ({ many, one }) => ({
    sector: one(nis2Sectors, {
      fields: [nis2CriticalServices.sectorId],
      references: [nis2Sectors.id],
    }),
    organizations: many(organizationCriticalServices),
  }),
);

export const organizationCriticalServicesRelations = relations(
  organizationCriticalServices,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationCriticalServices.organizationId],
      references: [organizations.id],
    }),
    criticalService: one(nis2CriticalServices, {
      fields: [organizationCriticalServices.criticalServiceId],
      references: [nis2CriticalServices.id],
    }),
  }),
);

export const selfCheckAssessmentsRelations = relations(
  selfCheckAssessments,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [selfCheckAssessments.organizationId],
      references: [organizations.id],
    }),
    lexSpecialisMatches: many(assessmentLexSpecialisMatches),
    questionnaireRuns: many(questionnaireRuns),
    guestSession: one(guestAssessmentSessions),
  }),
);

export const guestAssessmentSessionsRelations = relations(
  guestAssessmentSessions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [guestAssessmentSessions.organizationId],
      references: [organizations.id],
    }),
    assessment: one(selfCheckAssessments, {
      fields: [guestAssessmentSessions.assessmentId],
      references: [selfCheckAssessments.id],
    }),
  }),
);

export const assessmentLexSpecialisMatchesRelations = relations(
  assessmentLexSpecialisMatches,
  ({ one }) => ({
    assessment: one(selfCheckAssessments, {
      fields: [assessmentLexSpecialisMatches.assessmentId],
      references: [selfCheckAssessments.id],
    }),
    rule: one(lexSpecialisRules, {
      fields: [assessmentLexSpecialisMatches.ruleId],
      references: [lexSpecialisRules.id],
    }),
  }),
);

export const questionnaireTemplatesRelations = relations(
  questionnaireTemplates,
  ({ many }) => ({
    sections: many(questionnaireSections),
    runs: many(questionnaireRuns),
  }),
);

export const questionnaireSectionsRelations = relations(
  questionnaireSections,
  ({ many, one }) => ({
    template: one(questionnaireTemplates, {
      fields: [questionnaireSections.templateId],
      references: [questionnaireTemplates.id],
    }),
    questions: many(questionnaireQuestions),
  }),
);

export const questionnaireQuestionsRelations = relations(
  questionnaireQuestions,
  ({ many, one }) => ({
    section: one(questionnaireSections, {
      fields: [questionnaireQuestions.sectionId],
      references: [questionnaireSections.id],
    }),
    answers: many(questionnaireAnswers),
  }),
);

export const questionnaireRunsRelations = relations(
  questionnaireRuns,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [questionnaireRuns.organizationId],
      references: [organizations.id],
    }),
    template: one(questionnaireTemplates, {
      fields: [questionnaireRuns.templateId],
      references: [questionnaireTemplates.id],
    }),
    selfCheckAssessment: one(selfCheckAssessments, {
      fields: [questionnaireRuns.selfCheckAssessmentId],
      references: [selfCheckAssessments.id],
    }),
    answers: many(questionnaireAnswers),
    actionPlanItems: many(actionPlanItems),
  }),
);

export const questionnaireAnswersRelations = relations(
  questionnaireAnswers,
  ({ one }) => ({
    run: one(questionnaireRuns, {
      fields: [questionnaireAnswers.runId],
      references: [questionnaireRuns.id],
    }),
    question: one(questionnaireQuestions, {
      fields: [questionnaireAnswers.questionId],
      references: [questionnaireQuestions.id],
    }),
  }),
);

export const tomAreasRelations = relations(tomAreas, ({ many }) => ({
  requirements: many(organizationRequirements),
}));

export const organizationRequirementsRelations = relations(
  organizationRequirements,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [organizationRequirements.organizationId],
      references: [organizations.id],
    }),
    tomArea: one(tomAreas, {
      fields: [organizationRequirements.tomAreaId],
      references: [tomAreas.id],
    }),
    evidence: many(requirementEvidence),
    actionPlanItems: many(actionPlanItems),
  }),
);

export const requirementEvidenceRelations = relations(
  requirementEvidence,
  ({ one }) => ({
    requirement: one(organizationRequirements, {
      fields: [requirementEvidence.requirementId],
      references: [organizationRequirements.id],
    }),
  }),
);

export const suppliersRelations = relations(suppliers, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [suppliers.organizationId],
    references: [organizations.id],
  }),
  assessments: many(supplierAssessments),
}));

export const supplierAssessmentsRelations = relations(
  supplierAssessments,
  ({ one }) => ({
    supplier: one(suppliers, {
      fields: [supplierAssessments.supplierId],
      references: [suppliers.id],
    }),
  }),
);

export const registrationTasksRelations = relations(
  registrationTasks,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [registrationTasks.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const securityIncidentsRelations = relations(
  securityIncidents,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [securityIncidents.organizationId],
      references: [organizations.id],
    }),
    reports: many(incidentReports),
  }),
);

export const incidentReportsRelations = relations(incidentReports, ({ one }) => ({
  incident: one(securityIncidents, {
    fields: [incidentReports.incidentId],
    references: [securityIncidents.id],
  }),
}));

export const managementTrainingsRelations = relations(
  managementTrainings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [managementTrainings.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const aiChatsRelations = relations(aiChats, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [aiChats.organizationId],
    references: [organizations.id],
  }),
  messages: many(aiMessages),
  documents: many(aiDocuments),
  documentReviewRuns: many(documentReviewRuns),
  summaries: many(aiChatSummaries),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  chat: one(aiChats, {
    fields: [aiMessages.chatId],
    references: [aiChats.id],
  }),
  organization: one(organizations, {
    fields: [aiMessages.organizationId],
    references: [organizations.id],
  }),
}));

export const aiPromptVersionsRelations = relations(aiPromptVersions, () => ({}));

export const aiDocumentsRelations = relations(aiDocuments, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [aiDocuments.organizationId],
    references: [organizations.id],
  }),
  chat: one(aiChats, {
    fields: [aiDocuments.chatId],
    references: [aiChats.id],
  }),
  chunks: many(aiDocumentChunks),
  documentReviewRuns: many(documentReviewRuns),
  documentReviewFindings: many(documentReviewFindings),
  actionPlanItems: many(actionPlanItems),
}));

export const aiDocumentChunksRelations = relations(
  aiDocumentChunks,
  ({ one }) => ({
    document: one(aiDocuments, {
      fields: [aiDocumentChunks.documentId],
      references: [aiDocuments.id],
    }),
    organization: one(organizations, {
      fields: [aiDocumentChunks.organizationId],
      references: [organizations.id],
    }),
    chat: one(aiChats, {
      fields: [aiDocumentChunks.chatId],
      references: [aiChats.id],
    }),
  }),
);

export const documentRequirementTypesRelations = relations(
  documentRequirementTypes,
  ({ many }) => ({
    findings: many(documentReviewFindings),
  }),
);

export const documentReviewRunsRelations = relations(
  documentReviewRuns,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [documentReviewRuns.organizationId],
      references: [organizations.id],
    }),
    document: one(aiDocuments, {
      fields: [documentReviewRuns.documentId],
      references: [aiDocuments.id],
    }),
    chat: one(aiChats, {
      fields: [documentReviewRuns.chatId],
      references: [aiChats.id],
    }),
    findings: many(documentReviewFindings),
  }),
);

export const documentReviewFindingsRelations = relations(
  documentReviewFindings,
  ({ many, one }) => ({
    reviewRun: one(documentReviewRuns, {
      fields: [documentReviewFindings.reviewRunId],
      references: [documentReviewRuns.id],
    }),
    requirementType: one(documentRequirementTypes, {
      fields: [documentReviewFindings.requirementTypeId],
      references: [documentRequirementTypes.id],
    }),
    document: one(aiDocuments, {
      fields: [documentReviewFindings.documentId],
      references: [aiDocuments.id],
    }),
    actionPlanItems: many(actionPlanItems),
  }),
);

export const actionPlanItemsRelations = relations(
  actionPlanItems,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [actionPlanItems.organizationId],
      references: [organizations.id],
    }),
    requirement: one(organizationRequirements, {
      fields: [actionPlanItems.requirementId],
      references: [organizationRequirements.id],
    }),
    questionnaireRun: one(questionnaireRuns, {
      fields: [actionPlanItems.questionnaireRunId],
      references: [questionnaireRuns.id],
    }),
    documentReviewFinding: one(documentReviewFindings, {
      fields: [actionPlanItems.documentReviewFindingId],
      references: [documentReviewFindings.id],
    }),
    document: one(aiDocuments, {
      fields: [actionPlanItems.documentId],
      references: [aiDocuments.id],
    }),
  }),
);

export const reportExportsRelations = relations(reportExports, ({ one }) => ({
  organization: one(organizations, {
    fields: [reportExports.organizationId],
    references: [organizations.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, () => ({}));

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSettings.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const aiChatSummariesRelations = relations(
  aiChatSummaries,
  ({ one }) => ({
    chat: one(aiChats, {
      fields: [aiChatSummaries.chatId],
      references: [aiChats.id],
    }),
    organization: one(organizations, {
      fields: [aiChatSummaries.organizationId],
      references: [organizations.id],
    }),
    lastCoveredMessage: one(aiMessages, {
      fields: [aiChatSummaries.lastCoveredMessageId],
      references: [aiMessages.id],
    }),
  }),
);
