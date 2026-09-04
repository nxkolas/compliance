import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { createdAt, tsvector, updatedAt, vector } from "./_shared";
import { processingStatusEnum } from "./legal-corpus";

function documentVersionIdentity(): [AnyPgColumn, AnyPgColumn] {
  return [documentVersions.documentId, documentVersions.id];
}

export const documents = pgTable.withRLS(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 240 }).notNull(),
    currentVersionId: uuid("current_version_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("documents_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "documents_current_version_identity_fk",
      columns: [table.id, table.currentVersionId],
      foreignColumns: documentVersionIdentity(),
    }).onDelete("restrict"),
    index("documents_organization_archive_idx").on(
      table.organizationId,
      table.archivedAt,
    ),
  ],
);

export const documentVersions = pgTable.withRLS(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    documentId: uuid("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: text("content_hash").notNull(),
    indexingStatus: processingStatusEnum("indexing_status").default("pending").notNull(),
    parser: text("parser").notNull(),
    // The vector space these chunks live in, recorded in full. `embedding_key`
    // is the hash the retrieval filter compares; the component columns exist so
    // a human or an operator query can tell what a key actually means.
    embeddingModel: text("embedding_model").notNull(),
    embeddingRevision: text("embedding_revision").notNull(),
    embeddingDimensions: integer("embedding_dimensions").notNull(),
    embeddingInstructionProfile: text("embedding_instruction_profile").notNull(),
    embeddingKey: text("embedding_key").notNull(),
    indexingStartedAt: timestamp("indexing_started_at", { withTimezone: true }),
    indexingCompletedAt: timestamp("indexing_completed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "document_versions_document_tenant_fk",
      columns: [table.organizationId, table.documentId],
      foreignColumns: [documents.organizationId, documents.id],
    }).onDelete("cascade"),
    uniqueIndex("document_versions_document_number_unique").on(
      table.documentId,
      table.versionNumber,
    ),
    uniqueIndex("document_versions_document_id_identity_unique").on(
      table.documentId,
      table.id,
    ),
    uniqueIndex("document_versions_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("document_versions_storage_unique").on(
      table.storageBucket,
      table.storageKey,
    ),
    check("document_versions_number_check", sql`${table.versionNumber} > 0`),
    check("document_versions_byte_size_check", sql`${table.byteSize} > 0`),
    check(
      "document_versions_indexing_lifecycle_check",
      sql`(${table.indexingStatus} = 'succeeded' and ${table.indexingCompletedAt} is not null and ${table.failureCode} is null) or (${table.indexingStatus} = 'failed' and ${table.failureCode} is not null) or (${table.indexingStatus} in ('pending', 'processing') and ${table.indexingCompletedAt} is null)`,
    ),
  ],
);

export const documentChunks = pgTable.withRLS(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    position: integer("position").notNull(),
    pageNumber: integer("page_number"),
    sectionPath: text("section_path"),
    text: text("text").notNull(),
    contentHash: text("content_hash").notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce("text", ''))`,
    ),
    embedding: vector("embedding"),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "document_chunks_version_tenant_fk",
      columns: [table.organizationId, table.documentVersionId],
      foreignColumns: [documentVersions.organizationId, documentVersions.id],
    }).onDelete("cascade"),
    uniqueIndex("document_chunks_version_position_unique").on(
      table.documentVersionId,
      table.position,
    ),
    uniqueIndex("document_chunks_organization_id_identity_unique").on(
      table.organizationId,
      table.id,
    ),
    index("document_chunks_search_idx").using("gin", table.searchVector),
    check("document_chunks_position_check", sql`${table.position} >= 0`),
  ],
);
