import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, foreignKey, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, tsvector, updatedAt } from "./_shared";
import { backgroundJobs } from "./jobs";

function corpusSnapshotIdentity(): [AnyPgColumn, AnyPgColumn] {
  return [legalCorpusSnapshots.familyId, legalCorpusSnapshots.id];
}

export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "processing",
  // The server has prepared an inference request and is waiting for an
  // organization's browser to execute it against their own model. Distinct from
  // `processing`, which means the server itself is working: nothing advances
  // here until a client claims the request. Only `ai_processing_runs` uses it.
  "awaiting_client",
  "succeeded",
  "failed",
]);

export const legalAuthorityTierEnum = pgEnum("legal_authority_tier", [
  "official",
  "trusted_translation",
  "secondary",
]);

export const legalTranslationStatusEnum = pgEnum("legal_translation_status", [
  "original",
  "official",
  "reviewed",
  "unreviewed",
]);

export const legalCorpusFamilies = pgTable.withRLS(
  "legal_corpus_families",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    currentSnapshotId: uuid("current_snapshot_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("legal_corpus_families_code_unique").on(table.code),
    foreignKey({
      name: "legal_corpus_families_current_snapshot_identity_fk",
      columns: [table.id, table.currentSnapshotId],
      foreignColumns: corpusSnapshotIdentity(),
    }).onDelete("restrict"),
  ],
);

export const legalSources = pgTable.withRLS(
  "legal_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => legalCorpusFamilies.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    jurisdictionCode: varchar("jurisdiction_code", { length: 2 }).notNull(),
    authorityTier: legalAuthorityTierEnum("authority_tier").notNull(),
    officialSourceUrl: text("official_source_url").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("legal_sources_family_code_unique").on(table.familyId, table.code),
    uniqueIndex("legal_sources_family_id_identity_unique").on(table.familyId, table.id),
  ],
);

export const legalSourceVersions = pgTable.withRLS(
  "legal_source_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    versionLabel: text("version_label").notNull(),
    contentHash: text("content_hash").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "legal_source_versions_source_family_fk",
      columns: [table.familyId, table.sourceId],
      foreignColumns: [legalSources.familyId, legalSources.id],
    }).onDelete("cascade"),
    uniqueIndex("legal_source_versions_source_label_unique").on(
      table.sourceId,
      table.versionLabel,
    ),
    uniqueIndex("legal_source_versions_family_id_identity_unique").on(
      table.familyId,
      table.id,
    ),
    uniqueIndex("legal_source_versions_source_id_identity_unique").on(
      table.sourceId,
      table.id,
    ),
  ],
);

export const legalSourceRenditions = pgTable.withRLS(
  "legal_source_renditions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceVersionId: uuid("source_version_id")
      .notNull()
      .references(() => legalSourceVersions.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 5 }).notNull(),
    translationStatus: legalTranslationStatusEnum("translation_status").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("legal_source_renditions_version_locale_unique").on(
      table.sourceVersionId,
      table.locale,
    ),
    uniqueIndex("legal_source_renditions_storage_unique").on(
      table.storageBucket,
      table.storageKey,
    ),
    check("legal_source_renditions_locale_check", sql`${table.locale} in ('de', 'en')`),
  ],
);

export const legalSourceProcessingGenerations = pgTable.withRLS(
  "legal_source_processing_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    renditionId: uuid("rendition_id")
      .notNull()
      .references(() => legalSourceRenditions.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => backgroundJobs.id, {
      onDelete: "set null",
    }),
    status: processingStatusEnum("status").default("pending").notNull(),
    parser: text("parser").notNull(),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    // The legal corpus carries no vectors, so the parser is the only
    // processing configuration that distinguishes generations of a rendition.
    uniqueIndex("legal_processing_rendition_config_unique").on(
      table.renditionId,
      table.parser,
    ),
    check(
      "legal_processing_lifecycle_check",
      sql`(${table.status} = 'succeeded' and ${table.completedAt} is not null and ${table.failureCode} is null) or (${table.status} = 'failed' and ${table.completedAt} is not null and ${table.failureCode} is not null) or (${table.status} in ('pending', 'processing') and ${table.completedAt} is null)`,
    ),
  ],
);

export const legalSourceChunks = pgTable.withRLS(
  "legal_source_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    processingGenerationId: uuid("processing_generation_id")
      .notNull()
      .references(() => legalSourceProcessingGenerations.id, {
        onDelete: "cascade",
      }),
    position: integer("position").notNull(),
    pageNumber: integer("page_number"),
    sectionPath: text("section_path"),
    text: text("text").notNull(),
    contentHash: text("content_hash").notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce("text", ''))`,
    ),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("legal_source_chunks_generation_position_unique").on(
      table.processingGenerationId,
      table.position,
    ),
    index("legal_source_chunks_search_idx").using("gin", table.searchVector),
  ],
);

export const legalProvisionChunkBindings = pgTable.withRLS(
  "legal_provision_chunk_bindings",
  {
    stableProvisionKey: text("stable_provision_key").notNull(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => legalSourceChunks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.stableProvisionKey, table.chunkId] }),
    index("legal_provision_chunk_bindings_chunk_idx").on(table.chunkId),
  ],
);

/**
 * Authored best-practice guidance, global rather than per organization.
 *
 * Deliberately much lighter than the legal corpus: no versions, renditions,
 * processing generations, snapshots, authority tiers or translation status.
 * Those exist to prove which law, in which official translation, was in force
 * on a given date. Guidance makes no such claim — it explains what good looks
 * like, so a content hash plus a reviewed binding is the whole provenance
 * requirement.
 *
 * `licence` and `attribution` are not decorative. ENISA material is CC BY 4.0,
 * which permits commercial reuse only with credit, so the terms travel with the
 * content rather than living in a README.
 */
export const guidanceSources = pgTable.withRLS(
  "guidance_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    version: text("version").notNull(),
    url: text("url").notNull(),
    licence: text("licence").notNull(),
    attribution: text("attribution").notNull(),
    language: varchar("language", { length: 5 }).notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("guidance_sources_slug_unique").on(table.slug)],
);

export const guidanceChunks = pgTable.withRLS(
  "guidance_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => guidanceSources.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    sectionPath: text("section_path"),
    text: text("text").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("guidance_chunks_source_position_unique").on(
      table.sourceId,
      table.position,
    ),
  ],
);

/**
 * Reviewed mapping from a legal provision key to a guidance chunk, mirroring
 * `legalProvisionChunkBindings`. Requirements already carry provision keys such
 * as `eu_nis2.article_21_2_e`, so this is what lets guidance reach the right
 * category without inventing a second mapping concept.
 */
export const guidanceProvisionBindings = pgTable.withRLS(
  "guidance_provision_bindings",
  {
    stableProvisionKey: text("stable_provision_key").notNull(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => guidanceChunks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.stableProvisionKey, table.chunkId] }),
    index("guidance_provision_bindings_chunk_idx").on(table.chunkId),
  ],
);

export const legalCorpusSnapshots = pgTable.withRLS(
  "legal_corpus_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => legalCorpusFamilies.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    validatedBy: text("validated_by").notNull(),
    validatedAt: timestamp("validated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("legal_corpus_snapshots_family_hash_unique").on(
      table.familyId,
      table.contentHash,
    ),
    uniqueIndex("legal_corpus_snapshots_family_id_identity_unique").on(
      table.familyId,
      table.id,
    ),
  ],
);

export const legalCorpusSnapshotMembers = pgTable.withRLS(
  "legal_corpus_snapshot_members",
  {
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => legalCorpusSnapshots.id, { onDelete: "cascade" }),
    processingGenerationId: uuid("processing_generation_id")
      .notNull()
      .references(() => legalSourceProcessingGenerations.id, {
        onDelete: "restrict",
      }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.processingGenerationId] }),
    uniqueIndex("legal_corpus_snapshot_members_position_unique").on(
      table.snapshotId,
      table.position,
    ),
  ],
);
