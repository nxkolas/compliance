import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { createdAt, updatedAt } from "./_shared";
import { analysisOutputRevisions } from "./assessments";
import { backgroundJobs } from "./jobs";
import { gapFindings, gapItems } from "./gap-analysis";

export const actionPlanItemStatusEnum = pgEnum("action_plan_item_status", [
  "open",
  "in_progress",
  "done",
  "cancelled",
]);

export const actionPlans = pgTable.withRLS(
  "action_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceGapRevisionId: uuid("source_gap_revision_id").notNull(),
    generationJobId: uuid("generation_job_id"),
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
    foreignKey({
      name: "action_plans_generation_job_tenant_fk",
      columns: [table.organizationId, table.generationJobId],
      foreignColumns: [backgroundJobs.organizationId, backgroundJobs.id],
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
    result: text("result").notNull(),
    suggestedEvidence: jsonb("suggested_evidence").$type<string[]>().notNull(),
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
    check(
      "action_plan_items_suggested_evidence_array_check",
      sql`jsonb_typeof(${table.suggestedEvidence}) = 'array'`,
    ),
  ],
);

export const actionPlanItemGaps = pgTable.withRLS(
  "action_plan_item_gaps",
  {
    organizationId: uuid("organization_id").notNull(),
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
