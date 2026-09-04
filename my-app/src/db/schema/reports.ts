import { sql } from "drizzle-orm";
import { check, foreignKey, integer, pgTable, primaryKey, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { createdAt } from "./_shared";
import { analysisOutputRevisions } from "./assessments";
import { actionPlans } from "./action-plans";
import { backgroundJobs } from "./jobs";
import { documentVersions } from "./documents";

export const reports = pgTable.withRLS(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    applicabilityRevisionId: uuid("applicability_revision_id").notNull(),
    gapRevisionId: uuid("gap_revision_id"),
    actionPlanId: uuid("action_plan_id"),
    renderingJobId: uuid("rendering_job_id").notNull(),
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
    foreignKey({
      name: "reports_rendering_job_tenant_fk",
      columns: [table.organizationId, table.renderingJobId],
      foreignColumns: [backgroundJobs.organizationId, backgroundJobs.id],
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
