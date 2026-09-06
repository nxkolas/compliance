import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { createdAt, updatedAt } from "./_shared";
import { backgroundJobs } from "./jobs";
import { documentVersions } from "./documents";

function assessmentRevisionIdentity(): [AnyPgColumn, AnyPgColumn] {
  return [assessmentRevisions.assessmentId, assessmentRevisions.id];
}

function outputRevisionIdentity(): [AnyPgColumn, AnyPgColumn] {
  return [analysisOutputRevisions.outputId, analysisOutputRevisions.id];
}

export const assessmentKindEnum = pgEnum("assessment_kind", [
  "applicability",
  "gap",
]);

export const analysisOutputKindEnum = pgEnum("analysis_output_kind", [
  "applicability",
  "gap",
]);

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
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "analysis_output_revisions_generation_job_tenant_fk",
      columns: [table.organizationId, table.generationJobId],
      foreignColumns: [backgroundJobs.organizationId, backgroundJobs.id],
    }).onDelete("restrict"),
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
