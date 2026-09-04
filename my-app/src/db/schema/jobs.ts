import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { createdAt, updatedAt } from "./_shared";

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
