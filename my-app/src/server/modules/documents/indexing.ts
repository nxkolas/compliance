import { createHash } from "node:crypto";
import { db } from "@/src/db";
import { auditEvents, backgroundJobs, documentChunks, documentVersions, organizationEmbeddingMigrations, organizations } from "@/src/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { withAuthorizedOrganizationCommand, type OrganizationScopeExecutor } from "../../platform/auth/organization-scope";
import { enqueueJob } from "../../platform/jobs";
import { chunkExtractedPages } from "../../platform/content-processing/chunker";
import { embeddingIdentityColumns, MAX_DOCUMENT_BYTES, resolveEmbeddingConfig, type EmbeddingConfig } from "./document-config";
import { createDocumentEmbeddingProvider, createDocumentEmbeddingProviderFromConfig, type DocumentEmbeddingProvider, validateEmbeddings } from "./embeddings";
import { parseDocument } from "../../platform/content-processing/parser";
import { commitOrganizationEmbeddingSettings, embeddingConfigFromSettings, readOrganizationModelSettings } from "../organizations/model-settings-service";
import { createClientRelayEmbeddingProvider } from "../../platform/ai/client-inference/embedding-relay";
import { getOrganizationDocumentDetail, requireDocument } from "./queries";
import { downloadObject } from "./uploads";

export async function retryOrganizationDocumentIndexing(userId: string, organizationId: string, documentId: string) {
  const result = await withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "documents:write" }, async ({ executor }) => {
    const document = await requireDocument(organizationId, documentId, executor);
    if (document.archivedAt) throw new ApiError(409, "Restore the document before retrying indexing");
    const version = document.currentVersionId ? await executor.query.documentVersions.findFirst({ where: { RAW: (table, operators) => and(eq(table.id, document.currentVersionId!), eq(table.organizationId, organizationId)) ?? operators.sql`true` } }) : null;
    if (!version) throw new ApiError(404, "Document version not found");
    if (version.indexingStatus !== "failed") return { changed: false } as const;
    await executor.delete(documentChunks).where(and(eq(documentChunks.documentVersionId, version.id), eq(documentChunks.organizationId, organizationId)));
    await executor.update(documentVersions).set({ indexingStatus: "pending", failureCode: null, failureMessage: null, indexingStartedAt: null, indexingCompletedAt: null }).where(and(eq(documentVersions.id, version.id), eq(documentVersions.organizationId, organizationId)));
    await enqueueJob({ organizationId, requestedByUserId: userId, kind: "document_indexing", payload: { documentVersionId: version.id } }, { executor });
    return { changed: true } as const;
  });
  void result;
  return getOrganizationDocumentDetail(userId, organizationId, documentId);
}

/**
 * Reads the embedding coordinates an organization's vectors are stored in.
 *
 * An organization running its own model carries a settings row naming it; that
 * row is authoritative, and it advances only once a migration has rebuilt every
 * vector, so it always describes the data on disk. An organization on OpenAI
 * has nothing to choose and resolves from the deployment configuration.
 *
 * A `self_hosted` organization with no row yet falls back to the deployment's
 * `SELF_HOSTED_AI_*` values. That is the single-model local development setup
 * described in the local model runbook, and it stays supported.
 *
 * Falls back to the server default when the organization is not found, which
 * keeps operator commands with no organization in scope working.
 */
export async function resolveOrganizationEmbeddingConfig(
  organizationId: string,
  executor: OrganizationScopeExecutor = db,
) {
  return (await resolveOrganizationEmbedding(organizationId, executor)).config;
}

/**
 * The organization's embedding coordinates, plus whether reaching that model
 * requires a browser.
 *
 * `relayed` is what separates an organization running a model on someone's
 * laptop from one whose model the server can call directly. Both are
 * `self_hosted`; only the first has recorded its own model, and only the first
 * needs a client attached to embed anything.
 */
export async function resolveOrganizationEmbedding(
  organizationId: string,
  executor: OrganizationScopeExecutor = db,
): Promise<{ config: EmbeddingConfig; relayed: boolean }> {
  const organization = await executor.query.organizations.findFirst({
    columns: { aiProviderMode: true },
    where: { RAW: (table, operators) => eq(table.id, organizationId) ?? operators.sql`true` },
  });
  if (organization?.aiProviderMode === "self_hosted") {
    const settings = await readOrganizationModelSettings(organizationId, executor);
    if (settings) {
      return { config: embeddingConfigFromSettings(settings), relayed: true };
    }
  }
  return {
    config: resolveEmbeddingConfig(organization?.aiProviderMode),
    relayed: false,
  };
}

/**
 * Builds the embedder for one organization, relayed through a browser or not.
 *
 * Every embedding path routes through here so none of them can accidentally
 * embed with the deployment default. Note that the configuration is passed to
 * the constructor rather than just the provider mode: rebuilding from the mode
 * alone would discard the organization's chosen model and silently write
 * vectors labelled with a space they are not in.
 */
export async function organizationEmbeddingProvider(
  organizationId: string,
  options: { jobId?: string | null } = {},
  executor: OrganizationScopeExecutor = db,
) {
  const { config, relayed } = await resolveOrganizationEmbedding(
    organizationId,
    executor,
  );
  if (!relayed) return createDocumentEmbeddingProviderFromConfig(config);
  return createClientRelayEmbeddingProvider({
    organizationId,
    jobId: options.jobId ?? null,
    config,
  });
}

export async function executeDocumentIndexingJob(input: { documentVersionId: string; organizationId: string; jobId?: string }) {
  const version = await db.query.documentVersions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, input.documentVersionId), eq(table.organizationId, input.organizationId)) ?? operators.sql`true` },
  });
  if (!version) throw new ApiError(404, "Document version not found");
  const bytes = await downloadObject(version.storageBucket, version.storageKey);
  await indexDocumentVersion({
    versionId: version.id,
    organizationId: input.organizationId,
    bytes,
    embeddingProvider: await organizationEmbeddingProvider(input.organizationId, {
      jobId: input.jobId ?? null,
    }),
  });
  return { type: "document_version", id: version.id };
}

/**
 * Rebuilds every stored vector for one organization, then commits its provider
 * change.
 *
 * `organizations.ai_provider_mode` still names the old provider for the whole
 * run, so retrieval keeps serving the vectors that actually exist. Only when
 * every document has been rebuilt do the provider and the migration row advance
 * together, in one transaction. A failure marks the migration terminal and
 * leaves the provider untouched; nothing can be left staged, because the
 * concurrency guard counts only pending and processing rows.
 *
 * Known limitation: a run that fails partway leaves the documents it already
 * rebuilt carrying the new model. Those rows stop matching the organization's
 * unchanged provider and drop out of retrieval until a later migration
 * succeeds. That is deliberately fail-safe rather than fail-correct -- it loses
 * recall, not accuracy -- but a failed switch should be retried promptly, or the
 * affected documents re-indexed individually.
 */
export async function executeOrganizationReembeddingJob(
  input: {
    organizationId: string;
    migrationId: string;
    jobId: string;
  },
  signal?: AbortSignal,
) {
  const migration = await db.query.organizationEmbeddingMigrations.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, input.migrationId),
          eq(table.organizationId, input.organizationId),
        ) ?? operators.sql`true`,
    },
  });
  if (!migration) throw new ApiError(404, "Embedding migration not found");
  if (migration.status === "succeeded") {
    return { type: "organization", id: input.organizationId };
  }

  // The requester is only recoverable from the job row, and the audit event
  // below is the durable record of who changed the organization's provider.
  const [job] = await db
    .select({ requestedBy: backgroundJobs.requestedBy })
    .from(backgroundJobs)
    .where(eq(backgroundJobs.id, input.jobId));
  const requestedBy = job?.requestedBy ?? undefined;

  // The coordinates pinned when the change was requested, not whatever the
  // organization resolves to now. A settings edit while this runs must not
  // retarget an in-flight rebuild.
  const targetConfig = migration.toEmbeddingConfig as EmbeddingConfig;
  const { relayed } = await resolveOrganizationEmbedding(input.organizationId);
  // For an organization whose model runs on a user's machine, this is the
  // operation that needs a browser open for its whole duration: every batch
  // parks the job until a client answers it.
  const provider = relayed
    ? createClientRelayEmbeddingProvider({
        organizationId: input.organizationId,
        jobId: input.jobId,
        config: targetConfig,
      })
    : createDocumentEmbeddingProviderFromConfig(targetConfig);
  // Only versions not already carrying the target identity. The after-response
  // drain gives each attempt a bounded window, so a run that is cut short must
  // resume where it stopped rather than start over -- and re-running a finished
  // migration becomes a no-op.
  const versions = await db
    .select({
      id: documentVersions.id,
      storageBucket: documentVersions.storageBucket,
      storageKey: documentVersions.storageKey,
    })
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.organizationId, input.organizationId),
        eq(documentVersions.indexingStatus, "succeeded"),
        ne(documentVersions.embeddingKey, provider.key),
      ),
    )
    .orderBy(documentVersions.id);

  const alreadyCompleted = migration.documentVersionsCompleted;
  const total = alreadyCompleted + versions.length;
  await db
    .update(organizationEmbeddingMigrations)
    .set({
      status: "processing",
      jobId: input.jobId,
      startedAt: migration.startedAt ?? new Date(),
      documentVersionsTotal: total,
      documentVersionsCompleted: alreadyCompleted,
    })
    .where(eq(organizationEmbeddingMigrations.id, migration.id));
  await db
    .update(backgroundJobs)
    .set({
      progressCurrent: alreadyCompleted,
      progressTotal: Math.max(1, total),
    })
    .where(eq(backgroundJobs.id, input.jobId));

  try {
    for (const [index, version] of versions.entries()) {
      signal?.throwIfAborted();
      const bytes = await downloadObject(version.storageBucket, version.storageKey);
      await indexDocumentVersion({
        versionId: version.id,
        organizationId: input.organizationId,
        bytes,
        embeddingProvider: provider,
      });
      const completed = alreadyCompleted + index + 1;
      await db
        .update(organizationEmbeddingMigrations)
        .set({ documentVersionsCompleted: completed })
        .where(eq(organizationEmbeddingMigrations.id, migration.id));
      await db
        .update(backgroundJobs)
        .set({ progressCurrent: completed })
        .where(eq(backgroundJobs.id, input.jobId));
    }
  } catch (error) {
    // An abort means the drain window closed or the request was cancelled, not
    // that anything is wrong. Returning the migration to `pending` keeps it
    // active for the concurrency guard and lets the next drain resume it;
    // `failed` is reserved for genuine errors.
    if (signal?.aborted) {
      await db
        .update(organizationEmbeddingMigrations)
        .set({ status: "pending" })
        .where(eq(organizationEmbeddingMigrations.id, migration.id));
      throw error;
    }
    await db
      .update(organizationEmbeddingMigrations)
      .set({
        status: "failed",
        completedAt: new Date(),
        failureCode: "ORGANIZATION_REEMBEDDING_FAILED",
        failureMessage:
          error instanceof Error ? error.message : "Re-embedding failed",
      })
      .where(eq(organizationEmbeddingMigrations.id, migration.id));
    throw error;
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    // Only when the provider itself moved. A model change within one provider
    // is the ordinary case now and leaves `ai_provider_mode` alone.
    if (migration.toProviderMode) {
      await tx
        .update(organizations)
        .set({ aiProviderMode: migration.toProviderMode, updatedAt: now })
        .where(eq(organizations.id, input.organizationId));
    }
    await tx
      .update(organizationEmbeddingMigrations)
      .set({
        status: "succeeded",
        completedAt: now,
        documentVersionsCompleted: versions.length,
        failureCode: null,
        failureMessage: null,
      })
      .where(eq(organizationEmbeddingMigrations.id, migration.id));
    // The organization's active coordinates advance in the same transaction
    // that finishes the rebuild, which is what makes them unable to disagree
    // with the vectors they describe. A no-op for an organization with no
    // settings row, whose coordinates come from the deployment configuration.
    await commitOrganizationEmbeddingSettings(
      input.organizationId,
      targetConfig,
      tx as never,
    );
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: requestedBy,
      eventType: "organization.embedding_provider_changed",
      entityType: "organization",
      entityId: input.organizationId,
      metadata: {
        migrationId: migration.id,
        fromProviderMode: migration.fromProviderMode,
        toProviderMode: migration.toProviderMode,
        fromEmbeddingKey: migration.fromEmbeddingKey,
        toEmbeddingKey: migration.toEmbeddingKey,
        embeddingModel: provider.model,
        embeddingRevision: provider.modelRevision,
        embeddingDimensions: provider.dimensions,
        embeddingInstructionProfile: provider.retrievalInstructionId,
        reindexedDocumentVersions: versions.length,
      },
    });
  });

  return { type: "organization", id: input.organizationId };
}

export async function indexDocumentVersion(input: {
  versionId: string;
  organizationId: string;
  bytes: Uint8Array;
  embeddingProvider?: DocumentEmbeddingProvider;
}) {
  const version = await db.query.documentVersions.findFirst({ where: { RAW: (table, operators) => eq(table.id, input.versionId) ?? operators.sql`true` } });
  if (!version) throw new Error("Document version not found");
  const startedAt = new Date();
  // Re-indexing an already-succeeded version has to clear the terminal fields:
  // document_versions_indexing_lifecycle_check requires indexingCompletedAt to
  // be null while a version is pending or processing.
  await db.update(documentVersions).set({
    indexingStatus: "processing",
    indexingStartedAt: startedAt,
    indexingCompletedAt: null,
    failureCode: null,
    failureMessage: null,
  }).where(eq(documentVersions.id, version.id));
  try {
    const parsed = await parseDocument(input.bytes, version.mimeType, {
      maxBytes: MAX_DOCUMENT_BYTES,
    });
    const chunks = chunkExtractedPages(parsed.pages);
    const provider = input.embeddingProvider ?? createDocumentEmbeddingProvider();
    const embeddings = await provider.embed(chunks.map((chunk) => chunk.content));
    validateEmbeddings(embeddings, chunks.length, provider.dimensions);
    await db.transaction(async (tx) => {
      await tx.delete(documentChunks).where(eq(documentChunks.documentVersionId, version.id));
      if (chunks.length) await tx.insert(documentChunks).values(chunks.map((chunk, position) => ({
        organizationId: input.organizationId,
        documentVersionId: version.id,
        position,
        pageNumber: chunk.pageNumber,
        sectionPath: chunk.sectionLabel,
        text: chunk.content,
        contentHash: createHash("sha256").update(chunk.content).digest("hex"),
        embedding: embeddings[position],
      })));
      // The identity is written from the embedder that actually produced these
      // vectors, not from the organization's current setting. A re-index that
      // races a settings change must label its rows with the space they are in.
      await tx.update(documentVersions).set({ indexingStatus: "succeeded", parser: parsed.parserKind, ...embeddingIdentityColumns(provider), indexingCompletedAt: new Date(), failureCode: null, failureMessage: null }).where(eq(documentVersions.id, version.id));
    });
  } catch (error) {
    await db.update(documentVersions).set({ indexingStatus: "failed", indexingCompletedAt: new Date(), failureCode: "DOCUMENT_INDEXING_FAILED", failureMessage: error instanceof Error ? error.message : "Indexing failed" }).where(eq(documentVersions.id, version.id));
    throw error;
  }
}
