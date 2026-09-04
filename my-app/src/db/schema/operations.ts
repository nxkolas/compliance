import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { createdAt, updatedAt } from "./_shared";

export const idempotencyStateEnum = pgEnum("idempotency_state", [
  "in_progress",
  "completed",
  "failed",
]);

export const uploadSessionStateEnum = pgEnum("upload_session_state", [
  "pending",
  "uploaded",
  "completed",
  "expired",
  "failed",
]);

export const uploadSessions = pgTable.withRLS(
  "upload_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    state: uploadSessionStateEnum("state").default("pending").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    expectedByteSize: integer("expected_byte_size").notNull(),
    expectedHash: text("expected_hash"),
    resultLocator: jsonb("result_locator"),
    requestedBy: uuid("requested_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("upload_sessions_storage_unique").on(
      table.storageBucket,
      table.storageKey,
    ),
    index("upload_sessions_expiry_idx").on(table.expiresAt),
    check("upload_sessions_size_check", sql`${table.expectedByteSize} > 0`),
  ],
);

export const idempotencyRecords = pgTable.withRLS(
  "idempotency_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    actorKey: text("actor_key").notNull(),
    scope: text("scope").notNull(),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    state: idempotencyStateEnum("state").default("in_progress").notNull(),
    responseStatus: integer("response_status"),
    resultLocator: jsonb("result_locator"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idempotency_records_request_unique").on(
      table.actorKey,
      table.scope,
      table.operation,
      table.idempotencyKey,
    ),
    index("idempotency_records_expiry_idx").on(table.expiresAt),
    check(
      "idempotency_records_result_check",
      sql`(${table.state} = 'completed' and ${table.responseStatus} is not null and ${table.resultLocator} is not null) or (${table.state} <> 'completed' and ${table.responseStatus} is null and ${table.resultLocator} is null)`,
    ),
  ],
);

export const apiRateLimitWindows = pgTable.withRLS(
  "api_rate_limit_windows",
  {
    key: text("key").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStartedAt] }),
    index("api_rate_limit_windows_expiry_idx").on(table.expiresAt),
    check("api_rate_limit_windows_count_check", sql`${table.requestCount} >= 0`),
  ],
);

export const auditEvents = pgTable.withRLS(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    requestId: text("request_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "audit_events_organization_fk",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete("restrict"),
    index("audit_events_organization_time_idx").on(
      table.organizationId,
      table.occurredAt,
    ),
  ],
);

export const platformAuditEvents = pgTable.withRLS(
  "platform_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operatorIdentity: text("operator_identity").notNull(),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    requestId: text("request_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("platform_audit_events_time_idx").on(table.occurredAt)],
);
