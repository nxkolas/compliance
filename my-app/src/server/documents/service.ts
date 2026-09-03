import { createHash, randomUUID } from "node:crypto";
import type { DocumentDto, DocumentListQuery } from "@/src/contracts/documents";
import { db } from "@/src/db";
import {
  auditEvents,
  backgroundJobs,
  documentChunks,
  documentVersions,
  documents,
  organizationEmbeddingMigrations,
  organizations,
  uploadSessions,
} from "@/src/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { hasOrganizationCapability } from "../auth/capabilities";
import {
  authorizeOrganizationRead,
  withAuthorizedOrganizationCommand,
  type OrganizationScopeExecutor,
} from "../auth/organization-scope";
import { enqueueJob } from "../jobs";
import { getSupabaseAdminClient } from "../supabase-admin";
import {
  canonicalizeUploadMimeType,
  failPreparedUploadSession,
  prepareUploadSession,
  signPreparedUploadSession,
  verifyUploadedObject,
  type PreparedUploadCompletion,
} from "../uploads";
import { chunkExtractedPages } from "./chunker";
import {
  DOCUMENT_STORAGE_BUCKET,
  embeddingIdentityColumns,
  MAX_DOCUMENT_BYTES,
  resolveEmbeddingConfig,
  SUPPORTED_DOCUMENT_TYPES,
  type EmbeddingConfig,
} from "./document-config";
import {
  createDocumentEmbeddingProvider,
  createDocumentEmbeddingProviderFromConfig,
  type DocumentEmbeddingProvider,
  validateEmbeddings,
} from "./embeddings";
import { parseDocument, validateDocumentUpload } from "./parser";
import {
  commitOrganizationEmbeddingSettings,
  embeddingConfigFromSettings,
  readOrganizationModelSettings,
} from "../organizations/model-settings-service";
import { createClientRelayEmbeddingProvider } from "../ai/client-inference/embedding-relay";

export type DocumentStorage = {
  upload(input: { bucket: string; path: string; bytes: Uint8Array; contentType: string }): Promise<void>;
  remove(input: { bucket: string; path: string }): Promise<void>;
};

export type UploadOrganizationDocumentCommand = {
  userId: string;
  organizationId: string;
  title: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};
export type UploadOrganizationDocumentVersionCommand = Omit<UploadOrganizationDocumentCommand, "title"> & { documentId: string };

export async function uploadOrganizationDocument(
  command: UploadOrganizationDocumentCommand,
  dependencies: { storage?: DocumentStorage; embeddingProvider?: DocumentEmbeddingProvider } = {},
) {
  await authorizeOrganizationRead({ actorUserId: command.userId, organizationId: command.organizationId, capability: "documents:write" });
  validateDocumentUpload({ fileName: command.fileName, mimeType: command.mimeType, byteSize: command.bytes.byteLength });
  const documentId = randomUUID();
  const versionId = randomUUID();
  const key = storageKey(command.organizationId, documentId, versionId, command.fileName);
  const storage = dependencies.storage ?? supabaseStorage;
  await storage.upload({ bucket: DOCUMENT_STORAGE_BUCKET, path: key, bytes: command.bytes, contentType: command.mimeType });
  try {
    await withAuthorizedOrganizationCommand({ actorUserId: command.userId, organizationId: command.organizationId, capability: "documents:write" }, ({ executor }) => createDocumentRecords({
      documentId,
      versionId,
      organizationId: command.organizationId,
      userId: command.userId,
      title: command.title,
      fileName: command.fileName,
      mimeType: command.mimeType,
      byteSize: command.bytes.byteLength,
      storageBucket: DOCUMENT_STORAGE_BUCKET,
      storageKey: key,
      contentHash: sha256(command.bytes),
      indexingStatus: "processing",
    }, executor));
    await indexDocumentVersion({
      versionId,
      organizationId: command.organizationId,
      bytes: command.bytes,
      embeddingProvider: dependencies.embeddingProvider,
    });
  } catch (error) {
    await storage.remove({ bucket: DOCUMENT_STORAGE_BUCKET, path: key });
    throw error;
  }
  return { documentId, documentVersionId: versionId };
}

export async function uploadOrganizationDocumentVersion(
  command: UploadOrganizationDocumentVersionCommand,
  dependencies: { storage?: DocumentStorage; embeddingProvider?: DocumentEmbeddingProvider } = {},
) {
  const initialScope = await authorizeOrganizationRead({ actorUserId: command.userId, organizationId: command.organizationId, capability: "documents:write" });
  const existing = await requireDocument(command.organizationId, command.documentId, initialScope.executor);
  if (existing.archivedAt) throw new ApiError(409, "Restore the document before adding a version");
  validateDocumentUpload({ fileName: command.fileName, mimeType: command.mimeType, byteSize: command.bytes.byteLength });
  const versionId = randomUUID();
  const key = storageKey(command.organizationId, command.documentId, versionId, command.fileName);
  const storage = dependencies.storage ?? supabaseStorage;
  await storage.upload({ bucket: DOCUMENT_STORAGE_BUCKET, path: key, bytes: command.bytes, contentType: command.mimeType });
  const [version] = await withAuthorizedOrganizationCommand({ actorUserId: command.userId, organizationId: command.organizationId, capability: "documents:write" }, async ({ executor }) => {
    const currentDocument = await requireDocument(command.organizationId, command.documentId, executor);
    if (currentDocument.archivedAt) throw new ApiError(409, "Restore the document before adding a version");
    const prior = await executor.select({ versionNumber: documentVersions.versionNumber }).from(documentVersions)
      .where(and(eq(documentVersions.documentId, command.documentId), eq(documentVersions.organizationId, command.organizationId)))
      .orderBy(desc(documentVersions.versionNumber));
    const organizationEmbedding =
      await resolveOrganizationEmbeddingConfig(command.organizationId, executor);
    return executor.insert(documentVersions).values({
    id: versionId,
    organizationId: command.organizationId,
    documentId: command.documentId,
    versionNumber: (prior[0]?.versionNumber ?? 0) + 1,
    fileName: command.fileName,
    mimeType: command.mimeType,
    byteSize: command.bytes.byteLength,
    storageBucket: DOCUMENT_STORAGE_BUCKET,
    storageKey: key,
    contentHash: sha256(command.bytes),
    indexingStatus: "processing",
    parser: parserName(command.mimeType),
    ...embeddingIdentityColumns(organizationEmbedding),
    indexingStartedAt: new Date(),
    createdBy: command.userId,
    }).returning();
  });
  if (!version) throw new Error("Document version was not created");
  await indexDocumentVersion({ versionId, organizationId: command.organizationId, bytes: command.bytes, embeddingProvider: dependencies.embeddingProvider });
  await withAuthorizedOrganizationCommand({ actorUserId: command.userId, organizationId: command.organizationId, capability: "documents:write" }, async ({ executor }) => {
    await executor.update(documents).set({ currentVersionId: versionId, updatedAt: new Date() }).where(and(eq(documents.id, command.documentId), eq(documents.organizationId, command.organizationId)));
  });
  return { documentId: command.documentId, documentVersionId: versionId };
}

export async function listOrganizationDocumentDtos(input: {
  userId: string;
  organizationId: string;
  query?: DocumentListQuery;
}) {
  const scope = await authorizeOrganizationRead({ actorUserId: input.userId, organizationId: input.organizationId, capability: "documents:read" });
  const query = input.query ?? { status: "active", limit: 25 };
  const all = await currentDocumentRows(input.organizationId, scope.executor);
  const search = ("search" in query ? query.search : undefined)?.toLocaleLowerCase();
  const filtered = all.filter(({ document }) => {
    if (query.status === "active" && document.archivedAt) return false;
    if (query.status === "archived" && !document.archivedAt) return false;
    return !search || document.name.toLocaleLowerCase().includes(search);
  });
  return {
    documents: filtered.slice(0, query.limit).map(toDocumentDto),
    permissions: {
      canUpload: hasOrganizationCapability(scope.membership.role, "documents:write"),
      canArchive: hasOrganizationCapability(scope.membership.role, "documents:archive"),
      canRestore: hasOrganizationCapability(scope.membership.role, "documents:archive"),
      canRetryIndexing: hasOrganizationCapability(scope.membership.role, "documents:write"),
    },
    counts: {
      all: all.length,
      active: all.filter(({ document }) => !document.archivedAt).length,
      archived: all.filter(({ document }) => Boolean(document.archivedAt)).length,
    },
    nextCursor: undefined,
  };
}

export async function getOrganizationDocumentLibrary(userId: string, organizationId: string) {
  const scope = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "documents:read" });
  return getOrganizationDocumentLibraryPreauthorized(organizationId, scope.executor);
}

export async function getOrganizationDocumentLibraryPreauthorized(organizationId: string, executor: OrganizationScopeExecutor = db) {
  const rows = await currentDocumentRows(organizationId, executor);
  return { documents: rows.map(toDocumentDto) };
}

export async function getOrganizationDocumentDetail(userId: string, organizationId: string, documentId: string) {
  const scope = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "documents:read" });
  const row = (await currentDocumentRows(organizationId, scope.executor)).find(({ document }) => document.id === documentId);
  return row ? toDocumentDto(row) : null;
}

export async function listOrganizationDocumentVersions(userId: string, organizationId: string, documentId: string) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "documents:read" });
  await requireDocument(organizationId, documentId, executor);
  return executor.select().from(documentVersions).where(and(eq(documentVersions.documentId, documentId), eq(documentVersions.organizationId, organizationId))).orderBy(desc(documentVersions.versionNumber));
}

export async function listOrganizationDocumentVersionsPage(input: { userId: string; organizationId: string; documentId: string; limit: number; cursor?: string }) {
  const versions = await listOrganizationDocumentVersions(input.userId, input.organizationId, input.documentId);
  return { items: versions.slice(0, input.limit), nextCursor: undefined };
}

export async function getOrganizationDocumentVersion(userId: string, organizationId: string, versionId: string) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "documents:read" });
  return executor.query.documentVersions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, versionId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
}

export async function createDocumentSourceAccess(
  userId: string,
  organizationId: string,
  documentId: string,
  options: { mode?: "inline" | "download"; page?: number } = {},
) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "documents:read" });
  const row = (await currentDocumentRows(organizationId, executor)).find(({ document }) => document.id === documentId);
  if (!row?.version) throw new ApiError(404, "Document not found");
  const { data, error } = await getSupabaseAdminClient().storage
    .from(row.version.storageBucket)
    .createSignedUrl(row.version.storageKey, 60, { download: options.mode === "download" });
  if (error) throw error;
  return { url: options.page ? `${data.signedUrl}#page=${options.page}` : data.signedUrl };
}

export async function restoreOrganizationDocument(userId: string, organizationId: string, documentId: string) {
  await withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "documents:archive" }, async ({ executor }) => {
    await executor.update(documents).set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)));
  });
  return getOrganizationDocumentDetail(userId, organizationId, documentId);
}

export async function archiveOrganizationDocument(userId: string, organizationId: string, documentId: string) {
  await withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "documents:archive" }, async ({ executor }) => {
    const document = await requireDocument(organizationId, documentId, executor);
    if (document.currentVersionId && await versionIsInUnfinishedCycle(document.currentVersionId, executor)) {
      throw new ApiError(409, "Document is selected in an unfinished Gap cycle", undefined, "DOCUMENT_IN_USE");
    }
    await executor.update(documents).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)));
  });
  return getOrganizationDocumentDetail(userId, organizationId, documentId);
}

export async function createDocumentUploadSession(input: {
  userId: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
}) {
  const policy = { bucket: DOCUMENT_STORAGE_BUCKET, maxBytes: MAX_DOCUMENT_BYTES, allowedMimeTypes: SUPPORTED_DOCUMENT_TYPES, expiresInSeconds: 600 };
  const session = await withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "documents:write" }, ({ executor }) => prepareUploadSession({
    organizationId: input.organizationId,
    userId: input.userId,
    scope: "document",
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    sha256: input.sha256,
    policy,
  }, executor));
  try {
    return await signPreparedUploadSession(session, async ({ bucket, objectPath }) => {
      const { data, error } = await getSupabaseAdminClient().storage.from(bucket).createSignedUploadUrl(objectPath);
      if (error) throw error;
      return data.token;
    }, policy.expiresInSeconds);
  } catch (error) {
    await failPreparedUploadSession(session.id);
    throw error;
  }
}

export async function completeDocumentUpload(input: {
  userId: string;
  organizationId: string;
  sessionId: string;
  title: string;
}) {
  await authorizeOrganizationRead({ actorUserId: input.userId, organizationId: input.organizationId, capability: "documents:write" });
  const upload = await verifyUploadedObject({
    sessionId: input.sessionId,
    userId: input.userId,
    organizationId: input.organizationId,
    verifyObject,
  });
  const result = await withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "documents:write" }, ({ executor }) => finalizeDocumentUpload({ upload, title: input.title }, executor));
  const document = await getOrganizationDocumentDetail(
    input.userId,
    input.organizationId,
    result.documentId,
  );
  if (!document) throw new Error("Committed document is unavailable");
  return {
    document,
    internalResultId: result.documentVersionId,
    replayed: result.replayed,
  };
}

export async function finalizeDocumentUpload(input: {
  upload: PreparedUploadCompletion;
  title: string;
  now?: Date;
}, executor?: OrganizationScopeExecutor) {
  const title = input.title.trim();
  if (!title) throw new ApiError(400, "A document title is required");

  const now = input.now ?? new Date();
  const ids = {
    documentId: randomUUID(),
    documentVersionId: randomUUID(),
    jobId: randomUUID(),
    auditEventId: randomUUID(),
  };

  const run = async (tx: OrganizationScopeExecutor) => {
    const [session] = await tx.select().from(uploadSessions)
      .where(eq(uploadSessions.id, input.upload.sessionId))
      .for("update");
    if (
      !session ||
      session.requestedBy !== input.upload.requestedBy ||
      session.organizationId !== input.upload.organizationId
    ) {
      throw new ApiError(404, "Upload session not found", undefined, "UPLOAD_SESSION_NOT_FOUND");
    }

    if (session.state === "completed") {
      const locator = parseDocumentVersionLocator(session.resultLocator);
      if (!locator) {
        throw new ApiError(409, "Completed upload result is unavailable");
      }
      const [version] = await tx.select({
        id: documentVersions.id,
        documentId: documentVersions.documentId,
      }).from(documentVersions).where(and(
        eq(documentVersions.id, locator.id),
        eq(documentVersions.organizationId, session.organizationId),
      ));
      if (!version) {
        throw new ApiError(409, "Completed upload result is unavailable");
      }
      return {
        documentId: version.documentId,
        documentVersionId: version.id,
        replayed: true,
      };
    }
    if (input.upload.kind !== "verified") {
      throw new ApiError(409, "Upload session changed", undefined, "UPLOAD_SESSION_CHANGED");
    }
    if (session.expiresAt <= now) {
      throw new ApiError(410, "Upload session expired", undefined, "UPLOAD_SESSION_EXPIRED");
    }
    if (session.state !== "uploaded") {
      throw new ApiError(409, "Upload session is not uploaded", undefined, "UPLOAD_SESSION_NOT_UPLOADED");
    }
    assertUploadIdentity(session, input.upload);

    const [document] = await tx.insert(documents).values({
      id: ids.documentId,
      organizationId: session.organizationId,
      name: title,
      createdBy: session.requestedBy,
    }).returning({ id: documents.id });
    if (!document) throw new Error("Document was not created");

    const organizationEmbedding =
      await resolveOrganizationEmbeddingConfig(session.organizationId, tx);
    const [version] = await tx.insert(documentVersions).values({
      id: ids.documentVersionId,
      organizationId: session.organizationId,
      documentId: ids.documentId,
      versionNumber: 1,
      fileName: session.fileName,
      mimeType: session.mimeType,
      byteSize: input.upload.object.byteSize,
      storageBucket: session.storageBucket,
      storageKey: session.storageKey,
      contentHash: input.upload.object.contentHash,
      indexingStatus: "pending",
      parser: parserName(session.mimeType),
      ...embeddingIdentityColumns(organizationEmbedding),
      createdBy: session.requestedBy,
    }).returning({ id: documentVersions.id });
    if (!version) throw new Error("Document version was not created");

    const [currentDocument] = await tx.update(documents).set({
      currentVersionId: ids.documentVersionId,
      updatedAt: now,
    }).where(eq(documents.id, ids.documentId)).returning({ id: documents.id });
    if (!currentDocument) throw new Error("Document current version was not updated");

    await enqueueJob({
      organizationId: session.organizationId,
      requestedByUserId: session.requestedBy,
      kind: "document_indexing",
      payload: { documentVersionId: ids.documentVersionId },
    }, { executor: tx, jobId: ids.jobId });

    const [completedSession] = await tx.update(uploadSessions).set({
      state: "completed",
      resultLocator: {
        type: "document_version",
        id: ids.documentVersionId,
      },
      updatedAt: now,
    }).where(and(
      eq(uploadSessions.id, session.id),
      eq(uploadSessions.state, "uploaded"),
    )).returning({ id: uploadSessions.id });
    if (!completedSession) throw new Error("Upload session was not completed");

    const [auditEvent] = await tx.insert(auditEvents).values({
      id: ids.auditEventId,
      organizationId: session.organizationId,
      actorUserId: session.requestedBy,
      eventType: "document.uploaded",
      entityType: "document_version",
      entityId: ids.documentVersionId,
      metadata: { documentId: ids.documentId, jobId: ids.jobId },
      occurredAt: now,
    }).returning({ id: auditEvents.id });
    if (!auditEvent) throw new Error("Document upload audit event was not created");

    return {
      documentId: ids.documentId,
      documentVersionId: ids.documentVersionId,
      replayed: false,
    };
  };
  return executor ? run(executor) : db.transaction(run);
}

function assertUploadIdentity(
  session: typeof uploadSessions.$inferSelect,
  upload: Extract<PreparedUploadCompletion, { kind: "verified" }>,
) {
  if (
    session.storageBucket !== upload.storageBucket ||
    session.storageKey !== upload.storageKey ||
    session.fileName !== upload.fileName ||
    session.mimeType !== upload.mimeType ||
    session.expectedByteSize !== upload.expectedByteSize ||
    session.expectedHash !== upload.expectedHash ||
    session.expiresAt.getTime() !== upload.expiresAt.getTime()
  ) {
    throw new ApiError(409, "Upload session changed", undefined, "UPLOAD_SESSION_CHANGED");
  }
  if (
    upload.object.byteSize !== session.expectedByteSize ||
    upload.object.mimeType !== canonicalizeUploadMimeType(session.mimeType) ||
    (session.expectedHash && upload.object.contentHash !== session.expectedHash)
  ) {
    throw new ApiError(422, "Uploaded object does not match the session", undefined, "UPLOAD_OBJECT_MISMATCH");
  }
}

function parseDocumentVersionLocator(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const locator = value as { type?: unknown; id?: unknown };
  return locator.type === "document_version" && typeof locator.id === "string"
    ? { type: locator.type, id: locator.id }
    : null;
}

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

async function createDocumentRecords(input: {
  documentId: string; versionId: string; organizationId: string; userId: string; title: string;
  fileName: string; mimeType: string; byteSize: number; storageBucket: string; storageKey: string;
  contentHash: string; indexingStatus: "pending" | "processing";
}, executor: OrganizationScopeExecutor = db) {
  const title = input.title.trim();
  if (!title) throw new ApiError(400, "A document title is required");
  const organizationEmbedding =
    await resolveOrganizationEmbeddingConfig(input.organizationId, executor);
    await executor.insert(documents).values({ id: input.documentId, organizationId: input.organizationId, name: title, createdBy: input.userId });
    await executor.insert(documentVersions).values({
      id: input.versionId,
      organizationId: input.organizationId,
      documentId: input.documentId,
      versionNumber: 1,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      storageBucket: input.storageBucket,
      storageKey: input.storageKey,
      contentHash: input.contentHash,
      indexingStatus: input.indexingStatus,
      parser: parserName(input.mimeType),
      ...embeddingIdentityColumns(organizationEmbedding),
      indexingStartedAt: input.indexingStatus === "processing" ? new Date() : null,
      createdBy: input.userId,
    });
    await executor.update(documents).set({ currentVersionId: input.versionId, updatedAt: new Date() }).where(and(eq(documents.id, input.documentId), eq(documents.organizationId, input.organizationId)));
}

async function indexDocumentVersion(input: {
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
    const parsed = await parseDocument(input.bytes, version.mimeType);
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

async function currentDocumentRows(organizationId: string, executor: OrganizationScopeExecutor = db) {
  return executor.select({ document: documents, version: documentVersions })
    .from(documents)
    .leftJoin(documentVersions, eq(documentVersions.id, documents.currentVersionId))
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.createdAt));
}

function toDocumentDto(row: Awaited<ReturnType<typeof currentDocumentRows>>[number]): DocumentDto {
  const version = row.version;
  if (!version) throw new Error(`Document ${row.document.id} has no current version`);
  return {
    id: row.document.id,
    title: row.document.name,
    mimeType: version.mimeType,
    byteSize: version.byteSize,
    uploadedAt: version.createdAt.toISOString(),
    status: row.document.archivedAt ? "archived" : "active",
    indexStatus: version.indexingStatus === "succeeded" ? "indexed" : version.indexingStatus === "failed" ? "failed" : "processing",
  };
}

async function requireDocument(organizationId: string, documentId: string, executor: OrganizationScopeExecutor = db) {
  const row = await executor.query.documents.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, documentId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!row) throw new ApiError(404, "Document not found", undefined, "DOCUMENT_NOT_FOUND");
  return row;
}

async function versionIsInUnfinishedCycle(versionId: string, executor: OrganizationScopeExecutor = db) {
  const row = await executor.query.gapAnalysisCycleDocuments.findFirst({
    where: { RAW: (table, operators) => eq(table.documentVersionId, versionId) ?? operators.sql`true` },
  });
  if (!row) return false;
  const cycle = await executor.query.gapAnalysisCycles.findFirst({
    columns: { stage: true },
    where: { RAW: (table, operators) => eq(table.id, row.cycleId) ?? operators.sql`true` },
  });
  return Boolean(cycle && cycle.stage !== "generated");
}

async function verifyObject(input: { bucket: string; objectPath: string }) {
  const bytes = await downloadObject(input.bucket, input.objectPath);
  return { size: bytes.byteLength, mimeType: inferMimeType(input.objectPath), sha256: sha256(bytes) };
}

async function downloadObject(bucket: string, key: string) {
  const { data, error } = await getSupabaseAdminClient().storage.from(bucket).download(key);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

function inferMimeType(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

function storageKey(organizationId: string, documentId: string, versionId: string, fileName: string) {
  return `${organizationId}/${documentId}/${versionId}/${fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
}

function parserName(mimeType: string) {
  return mimeType === "application/pdf" ? "pdf-parse" : mimeType.includes("wordprocessingml") ? "mammoth" : "plain-text";
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

const supabaseStorage: DocumentStorage = {
  async upload({ bucket, path, bytes, contentType }) {
    const { error } = await getSupabaseAdminClient().storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
    if (error) throw error;
  },
  async remove({ bucket, path }) {
    const { error } = await getSupabaseAdminClient().storage.from(bucket).remove([path]);
    if (error) throw error;
  },
};
