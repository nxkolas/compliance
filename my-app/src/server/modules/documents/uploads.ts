import { createHash, randomUUID } from "node:crypto";
import { db } from "@/src/db";
import { auditEvents, documentVersions, documents, uploadSessions } from "@/src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand, type OrganizationScopeExecutor } from "../../platform/auth/organization-scope";
import { enqueueJob } from "../../platform/jobs";
import { getSupabaseAdminClient } from "../../platform/storage/supabase-admin";
import { canonicalizeUploadMimeType, failPreparedUploadSession, prepareUploadSession, signPreparedUploadSession, verifyUploadedObject, type PreparedUploadCompletion } from "../../platform/storage";
import { DOCUMENT_STORAGE_BUCKET, embeddingIdentityColumns, MAX_DOCUMENT_BYTES, SUPPORTED_DOCUMENT_TYPES } from "./document-config";
import { type DocumentEmbeddingProvider } from "./embeddings";
import { validateDocumentUpload } from "./validation";
import type { DocumentStorage, UploadOrganizationDocumentCommand, UploadOrganizationDocumentVersionCommand } from "./model";
import { indexDocumentVersion, resolveOrganizationEmbeddingConfig } from "./indexing";
import { getOrganizationDocumentDetail, requireDocument, versionIsInUnfinishedCycle } from "./queries";

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

export function assertUploadIdentity(
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

export function parseDocumentVersionLocator(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const locator = value as { type?: unknown; id?: unknown };
  return locator.type === "document_version" && typeof locator.id === "string"
    ? { type: locator.type, id: locator.id }
    : null;
}

export async function createDocumentRecords(input: {
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

export async function verifyObject(input: { bucket: string; objectPath: string }) {
  const bytes = await downloadObject(input.bucket, input.objectPath);
  return { size: bytes.byteLength, mimeType: inferMimeType(input.objectPath), sha256: sha256(bytes) };
}

export async function downloadObject(bucket: string, key: string) {
  const { data, error } = await getSupabaseAdminClient().storage.from(bucket).download(key);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

export function inferMimeType(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

export function storageKey(organizationId: string, documentId: string, versionId: string, fileName: string) {
  return `${organizationId}/${documentId}/${versionId}/${fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
}

export function parserName(mimeType: string) {
  return mimeType === "application/pdf" ? "pdf-parse" : mimeType.includes("wordprocessingml") ? "mammoth" : "plain-text";
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export const supabaseStorage: DocumentStorage = {
  async upload({ bucket, path, bytes, contentType }) {
    const { error } = await getSupabaseAdminClient().storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
    if (error) throw error;
  },
  async remove({ bucket, path }) {
    const { error } = await getSupabaseAdminClient().storage.from(bucket).remove([path]);
    if (error) throw error;
  },
};
