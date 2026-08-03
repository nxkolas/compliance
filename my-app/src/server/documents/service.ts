import { createHash, randomUUID } from "node:crypto";
import type { DocumentDto, DocumentListQuery } from "@/src/contracts/documents";
import { db } from "@/src/db";
import {
  auditEvents,
  backgroundJobs,
  documentChunks,
  documentVersions,
  documents,
  uploadSessions,
} from "@/src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { hasOrganizationCapability } from "../auth/capabilities";
import { requireOrganizationCapability } from "../auth/capability-service";
import { getSupabaseAdminClient } from "../supabase-admin";
import {
  canonicalizeUploadMimeType,
  createUploadSession,
  verifyUploadedObject,
  type PreparedUploadCompletion,
} from "../uploads";
import { chunkExtractedPages } from "./chunker";
import {
  DOCUMENT_STORAGE_BUCKET,
  EMBEDDING_MODEL,
  MAX_DOCUMENT_BYTES,
  SUPPORTED_DOCUMENT_TYPES,
} from "./document-config";
import {
  createDocumentEmbeddingProvider,
  type DocumentEmbeddingProvider,
  validateEmbeddings,
} from "./embeddings";
import { parseDocument, validateDocumentUpload } from "./parser";

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
  await requireOrganizationCapability(command.userId, command.organizationId, "documents:write");
  validateDocumentUpload({ fileName: command.fileName, mimeType: command.mimeType, byteSize: command.bytes.byteLength });
  const documentId = randomUUID();
  const versionId = randomUUID();
  const key = storageKey(command.organizationId, documentId, versionId, command.fileName);
  const storage = dependencies.storage ?? supabaseStorage;
  await storage.upload({ bucket: DOCUMENT_STORAGE_BUCKET, path: key, bytes: command.bytes, contentType: command.mimeType });
  try {
    await createDocumentRecords({
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
    });
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
  await requireOrganizationCapability(command.userId, command.organizationId, "documents:write");
  const existing = await requireDocument(command.organizationId, command.documentId);
  if (existing.archivedAt) throw new ApiError(409, "Restore the document before adding a version");
  validateDocumentUpload({ fileName: command.fileName, mimeType: command.mimeType, byteSize: command.bytes.byteLength });
  const prior = await db.select({ versionNumber: documentVersions.versionNumber }).from(documentVersions)
    .where(eq(documentVersions.documentId, command.documentId)).orderBy(desc(documentVersions.versionNumber));
  const versionId = randomUUID();
  const key = storageKey(command.organizationId, command.documentId, versionId, command.fileName);
  const storage = dependencies.storage ?? supabaseStorage;
  await storage.upload({ bucket: DOCUMENT_STORAGE_BUCKET, path: key, bytes: command.bytes, contentType: command.mimeType });
  const [version] = await db.insert(documentVersions).values({
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
    embeddingModel: EMBEDDING_MODEL,
    indexingStartedAt: new Date(),
    createdBy: command.userId,
  }).returning();
  if (!version) throw new Error("Document version was not created");
  await indexDocumentVersion({ versionId, organizationId: command.organizationId, bytes: command.bytes, embeddingProvider: dependencies.embeddingProvider });
  await db.update(documents).set({ currentVersionId: versionId, updatedAt: new Date() }).where(eq(documents.id, command.documentId));
  return { documentId: command.documentId, documentVersionId: versionId };
}

export async function listOrganizationDocumentDtos(input: {
  userId: string;
  organizationId: string;
  query?: DocumentListQuery;
}) {
  const membership = await requireOrganizationCapability(input.userId, input.organizationId, "documents:read");
  const query = input.query ?? { status: "active", limit: 25 };
  const all = await currentDocumentRows(input.organizationId);
  const search = ("search" in query ? query.search : undefined)?.toLocaleLowerCase();
  const filtered = all.filter(({ document }) => {
    if (query.status === "active" && document.archivedAt) return false;
    if (query.status === "archived" && !document.archivedAt) return false;
    return !search || document.name.toLocaleLowerCase().includes(search);
  });
  return {
    documents: filtered.slice(0, query.limit).map(toDocumentDto),
    permissions: {
      canUpload: hasOrganizationCapability(membership.role, "documents:write"),
      canArchive: hasOrganizationCapability(membership.role, "documents:archive"),
      canRestore: hasOrganizationCapability(membership.role, "documents:archive"),
      canRetryIndexing: hasOrganizationCapability(membership.role, "documents:write"),
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
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  return getOrganizationDocumentLibraryPreauthorized(organizationId);
}

export async function getOrganizationDocumentLibraryPreauthorized(organizationId: string) {
  const rows = await currentDocumentRows(organizationId);
  return { documents: rows.map(toDocumentDto) };
}

export async function getOrganizationDocumentDetail(userId: string, organizationId: string, documentId: string) {
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  const row = (await currentDocumentRows(organizationId)).find(({ document }) => document.id === documentId);
  return row ? toDocumentDto(row) : null;
}

export async function listOrganizationDocumentVersions(userId: string, organizationId: string, documentId: string) {
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  await requireDocument(organizationId, documentId);
  return db.select().from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.versionNumber));
}

export async function listOrganizationDocumentVersionsPage(input: { userId: string; organizationId: string; documentId: string; limit: number; cursor?: string }) {
  const versions = await listOrganizationDocumentVersions(input.userId, input.organizationId, input.documentId);
  return { items: versions.slice(0, input.limit), nextCursor: undefined };
}

export async function getOrganizationDocumentVersion(userId: string, organizationId: string, versionId: string) {
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  return db.query.documentVersions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, versionId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
}

export async function createDocumentSourceAccess(
  userId: string,
  organizationId: string,
  documentId: string,
  options: { mode?: "inline" | "download"; page?: number } = {},
) {
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  const row = (await currentDocumentRows(organizationId)).find(({ document }) => document.id === documentId);
  if (!row?.version) throw new ApiError(404, "Document not found");
  const { data, error } = await getSupabaseAdminClient().storage
    .from(row.version.storageBucket)
    .createSignedUrl(row.version.storageKey, 60, { download: options.mode === "download" });
  if (error) throw error;
  return { url: options.page ? `${data.signedUrl}#page=${options.page}` : data.signedUrl };
}

export async function updateOrganizationDocument(input: { userId: string; organizationId: string; documentId: string; title: string; expectedVersion?: number }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "documents:write");
  const [document] = await db.update(documents).set({ name: input.title.trim(), updatedAt: new Date() })
    .where(and(eq(documents.id, input.documentId), eq(documents.organizationId, input.organizationId))).returning();
  if (!document) throw new ApiError(404, "Document not found");
  return getOrganizationDocumentDetail(input.userId, input.organizationId, input.documentId);
}

export async function restoreOrganizationDocument(userId: string, organizationId: string, documentId: string) {
  await requireOrganizationCapability(userId, organizationId, "documents:archive");
  await db.update(documents).set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)));
  return getOrganizationDocumentDetail(userId, organizationId, documentId);
}

export async function archiveOrganizationDocument(userId: string, organizationId: string, documentId: string) {
  await requireOrganizationCapability(userId, organizationId, "documents:archive");
  const document = await requireDocument(organizationId, documentId);
  if (document.currentVersionId && await versionIsInUnfinishedCycle(document.currentVersionId)) {
    throw new ApiError(409, "Document is selected in an unfinished Gap cycle", undefined, "DOCUMENT_IN_USE");
  }
  await db.update(documents).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(documents.id, documentId));
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
  await requireOrganizationCapability(input.userId, input.organizationId, "documents:write");
  return createUploadSession({
    organizationId: input.organizationId,
    userId: input.userId,
    scope: "document",
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    sha256: input.sha256,
    policy: { bucket: DOCUMENT_STORAGE_BUCKET, maxBytes: MAX_DOCUMENT_BYTES, allowedMimeTypes: SUPPORTED_DOCUMENT_TYPES, expiresInSeconds: 600 },
    signUpload: async ({ bucket, objectPath }) => {
      const { data, error } = await getSupabaseAdminClient().storage.from(bucket).createSignedUploadUrl(objectPath);
      if (error) throw error;
      return data.token;
    },
  });
}

export async function completeDocumentUpload(input: {
  userId: string;
  organizationId: string;
  sessionId: string;
  title: string;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "documents:write");
  const upload = await verifyUploadedObject({
    sessionId: input.sessionId,
    userId: input.userId,
    organizationId: input.organizationId,
    verifyObject,
  });
  const result = await finalizeDocumentUpload({ upload, title: input.title });
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
}) {
  const title = input.title.trim();
  if (!title) throw new ApiError(400, "A document title is required");

  const now = input.now ?? new Date();
  const ids = {
    documentId: randomUUID(),
    documentVersionId: randomUUID(),
    jobId: randomUUID(),
    auditEventId: randomUUID(),
  };

  return db.transaction(async (tx) => {
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
      embeddingModel: EMBEDDING_MODEL,
      createdBy: session.requestedBy,
    }).returning({ id: documentVersions.id });
    if (!version) throw new Error("Document version was not created");

    const [currentDocument] = await tx.update(documents).set({
      currentVersionId: ids.documentVersionId,
      updatedAt: now,
    }).where(eq(documents.id, ids.documentId)).returning({ id: documents.id });
    if (!currentDocument) throw new Error("Document current version was not updated");

    const [job] = await tx.insert(backgroundJobs).values({
      id: ids.jobId,
      organizationId: session.organizationId,
      kind: "document_indexing",
      payload: { documentVersionId: ids.documentVersionId },
      requestedBy: session.requestedBy,
    }).returning({ id: backgroundJobs.id });
    if (!job) throw new Error("Document indexing job was not created");

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
  });
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
  await requireOrganizationCapability(userId, organizationId, "documents:write");
  const document = await requireDocument(organizationId, documentId);
  if (document.archivedAt) throw new ApiError(409, "Restore the document before retrying indexing");
  const version = document.currentVersionId ? await db.query.documentVersions.findFirst({ where: { RAW: (table, operators) => eq(table.id, document.currentVersionId!) ?? operators.sql`true` } }) : null;
  if (!version) throw new ApiError(404, "Document version not found");
  if (version.indexingStatus !== "failed") return getOrganizationDocumentDetail(userId, organizationId, documentId);
  await db.transaction(async (tx) => {
    await tx.delete(documentChunks).where(eq(documentChunks.documentVersionId, version.id));
    await tx.update(documentVersions).set({ indexingStatus: "pending", failureCode: null, failureMessage: null, indexingStartedAt: null, indexingCompletedAt: null }).where(eq(documentVersions.id, version.id));
    await tx.insert(backgroundJobs).values({ organizationId, kind: "document_indexing", payload: { documentVersionId: version.id }, requestedBy: userId });
  });
  return getOrganizationDocumentDetail(userId, organizationId, documentId);
}

export async function executeDocumentIndexingJob(input: { documentVersionId: string; organizationId: string }) {
  const version = await db.query.documentVersions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, input.documentVersionId), eq(table.organizationId, input.organizationId)) ?? operators.sql`true` },
  });
  if (!version) throw new ApiError(404, "Document version not found");
  const bytes = await downloadObject(version.storageBucket, version.storageKey);
  await indexDocumentVersion({ versionId: version.id, organizationId: input.organizationId, bytes });
  return { type: "document_version", id: version.id };
}

async function createDocumentRecords(input: {
  documentId: string; versionId: string; organizationId: string; userId: string; title: string;
  fileName: string; mimeType: string; byteSize: number; storageBucket: string; storageKey: string;
  contentHash: string; indexingStatus: "pending" | "processing";
}) {
  const title = input.title.trim();
  if (!title) throw new ApiError(400, "A document title is required");
  await db.transaction(async (tx) => {
    await tx.insert(documents).values({ id: input.documentId, organizationId: input.organizationId, name: title, createdBy: input.userId });
    await tx.insert(documentVersions).values({
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
      embeddingModel: EMBEDDING_MODEL,
      indexingStartedAt: input.indexingStatus === "processing" ? new Date() : null,
      createdBy: input.userId,
    });
    await tx.update(documents).set({ currentVersionId: input.versionId, updatedAt: new Date() }).where(eq(documents.id, input.documentId));
  });
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
  await db.update(documentVersions).set({ indexingStatus: "processing", indexingStartedAt: startedAt }).where(eq(documentVersions.id, version.id));
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
      await tx.update(documentVersions).set({ indexingStatus: "succeeded", parser: parsed.parserKind, embeddingModel: provider.model, indexingCompletedAt: new Date(), failureCode: null, failureMessage: null }).where(eq(documentVersions.id, version.id));
    });
  } catch (error) {
    await db.update(documentVersions).set({ indexingStatus: "failed", indexingCompletedAt: new Date(), failureCode: "DOCUMENT_INDEXING_FAILED", failureMessage: error instanceof Error ? error.message : "Indexing failed" }).where(eq(documentVersions.id, version.id));
    throw error;
  }
}

async function currentDocumentRows(organizationId: string) {
  return db.select({ document: documents, version: documentVersions })
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

async function requireDocument(organizationId: string, documentId: string) {
  const row = await db.query.documents.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, documentId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!row) throw new ApiError(404, "Document not found", undefined, "DOCUMENT_NOT_FOUND");
  return row;
}

async function versionIsInUnfinishedCycle(versionId: string) {
  const row = await db.query.gapAnalysisCycleDocuments.findFirst({
    where: { RAW: (table, operators) => eq(table.documentVersionId, versionId) ?? operators.sql`true` },
  });
  if (!row) return false;
  const cycle = await db.query.gapAnalysisCycles.findFirst({
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
