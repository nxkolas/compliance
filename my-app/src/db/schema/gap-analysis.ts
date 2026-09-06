import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { createdAt, updatedAt } from "./_shared";
import { analysisOutputRevisions, assessmentRevisions } from "./assessments";
import { backgroundJobs } from "./jobs";
import { documentVersions } from "./documents";
import { aiProcessingRunContext } from "./ai";

export const gapAnalysisCycleStageEnum = pgEnum("gap_analysis_cycle_stage", [
  "questions",
  "evidence",
  "generating",
  "generated",
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
    foreignKey({
      name: "gap_analysis_cycles_generation_job_tenant_fk",
      columns: [table.organizationId, table.generationJobId],
      foreignColumns: [backgroundJobs.organizationId, backgroundJobs.id],
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
      name: "gap_findings_original_finding_tenant_fk",
      columns: [table.organizationId, table.originalFindingId],
      foreignColumns: [table.organizationId, table.id],
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
