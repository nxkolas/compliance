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

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  invitations: many(organizationInvitations),
  sectors: many(organizationSectors),
  selfCheckAssessments: many(selfCheckAssessments),
  requirements: many(organizationRequirements),
  suppliers: many(suppliers),
  registrationTasks: many(registrationTasks),
  securityIncidents: many(securityIncidents),
  managementTrainings: many(managementTrainings),
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

export const selfCheckAssessmentsRelations = relations(
  selfCheckAssessments,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [selfCheckAssessments.organizationId],
      references: [organizations.id],
    }),
    lexSpecialisMatches: many(assessmentLexSpecialisMatches),
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
