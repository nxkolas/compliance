import { createHash, randomUUID } from "node:crypto";
import { db } from "@/src/db";
import {
  auditEvents,
  documentChunkEmbeddings,
  documentChunks,
  documentEmbeddingGenerations,
  documentExtractions,
  documentVersions,
  documents,
} from "@/src/db/schema";
import { getSupabaseAdminClient } from "../supabase-admin";
import { and, desc, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  assertCanAccessOrganization,
  assertCanContributeToOrganization,
} from "../organizations/service";
import { chunkExtractedPages } from "./chunker";
import {
  CHUNKING_VERSION,
  DOCUMENT_STORAGE_BUCKET,
} from "./document-config";
import {
  createDocumentEmbeddingProvider,
  type DocumentEmbeddingProvider,
  validateEmbeddings,
} from "./embeddings";
import { parseDocument, validateDocumentUpload } from "./parser";

export type DocumentStorage = {
  upload(input: {
    bucket: string;
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<void>;
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

export async function uploadOrganizationDocument(
  command: UploadOrganizationDocumentCommand,
  dependencies: {
    storage?: DocumentStorage;
    embeddingProvider?: DocumentEmbeddingProvider;
  } = {},
) {
  await assertCanContributeToOrganization(command.userId, command.organizationId);
  validateDocumentUpload({
    fileName: command.fileName,
    mimeType: command.mimeType,
    byteSize: command.bytes.byteLength,
  });
  const title = command.title.trim();
  if (!title) throw new ApiError(400, "A document title is required");

  const storage = dependencies.storage ?? supabaseDocumentStorage;
  const embeddingProvider =
    dependencies.embeddingProvider ?? createDocumentEmbeddingProvider();
  const documentId = randomUUID();
  const documentVersionId = randomUUID();
  const extractionId = randomUUID();
  const embeddingGenerationId = randomUUID();
  const fileName = sanitizeFileName(command.fileName);
  const storagePath = `${command.organizationId}/${documentId}/${documentVersionId}/${fileName}`;
  const contentHash = sha256(command.bytes);
  await storage.upload({
    bucket: DOCUMENT_STORAGE_BUCKET,
    path: storagePath,
    bytes: command.bytes,
    contentType: command.mimeType,
  });

  try {
    await db.transaction(async (tx) => {
      await tx.insert(documents).values({
        id: documentId,
        organizationId: command.organizationId,
        title,
        createdBy: command.userId,
      });
      await tx.insert(documentVersions).values({
        id: documentVersionId,
        documentId,
        versionNumber: 1,
        fileName: command.fileName,
        mimeType: command.mimeType,
        byteSize: command.bytes.byteLength,
        storageBucket: DOCUMENT_STORAGE_BUCKET,
        storagePath,
        contentHash,
        uploadedBy: command.userId,
      });
      await tx
        .update(documents)
        .set({ currentVersionId: documentVersionId })
        .where(eq(documents.id, documentId));
      await tx.insert(documentExtractions).values({
        id: extractionId,
        documentVersionId,
        parserKind: parserKindForMime(command.mimeType),
        parserVersion: "v1",
        status: "processing",
        startedAt: new Date(),
      });
      await tx.insert(documentEmbeddingGenerations).values({
        id: embeddingGenerationId,
        extractionId,
        provider: embeddingProvider.provider,
        model: embeddingProvider.model,
        dimensions: embeddingProvider.dimensions,
        chunkingVersion: CHUNKING_VERSION,
        status: "pending",
      });
      await tx.insert(auditEvents).values({
        organizationId: command.organizationId,
        actorUserId: command.userId,
        eventType: "document.uploaded",
        entityType: "document_version",
        entityId: documentVersionId,
        metadata: { contentHash, mimeType: command.mimeType },
      });
    });
  } catch (error) {
    await storage.remove({ bucket: DOCUMENT_STORAGE_BUCKET, path: storagePath });
    throw error;
  }

  let persistedChunks: Array<{ id: string; content: string }> = [];
  try {
    const parsed = await parseDocument(command.bytes, command.mimeType);
    const chunkInputs = chunkExtractedPages(parsed.pages);
    if (chunkInputs.length === 0) throw new Error("Extraction produced no chunks");
    persistedChunks = await db.transaction(async (tx) => {
      await tx
        .update(documentExtractions)
        .set({
          parserKind: parsed.parserKind,
          parserVersion: parsed.parserVersion,
          status: "succeeded",
          extractedText: parsed.text,
          extractedTextHash: sha256(parsed.text),
          metadata: parsed.metadata,
          completedAt: new Date(),
        })
        .where(eq(documentExtractions.id, extractionId));
      return tx
        .insert(documentChunks)
        .values(
          chunkInputs.map((chunk) => ({
            extractionId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            contentHash: sha256(chunk.content),
            pageNumber: chunk.pageNumber,
            sectionLabel: chunk.sectionLabel,
            tokenCount: chunk.tokenCount,
          })),
        )
        .returning({ id: documentChunks.id, content: documentChunks.content });
    });
  } catch (error) {
    await markProcessingFailed({
      extractionId,
      embeddingGenerationId,
      error,
    });
    throw toProcessingError(error, "Document extraction failed");
  }

  try {
    await db
      .update(documentEmbeddingGenerations)
      .set({ status: "processing", startedAt: new Date() })
      .where(eq(documentEmbeddingGenerations.id, embeddingGenerationId));
    const embeddings = await embeddingProvider.embed(
      persistedChunks.map((chunk) => chunk.content),
    );
    validateEmbeddings(
      embeddings,
      persistedChunks.length,
      embeddingProvider.dimensions,
    );
    await db.transaction(async (tx) => {
      await tx.insert(documentChunkEmbeddings).values(
        persistedChunks.map((chunk, index) => ({
          generationId: embeddingGenerationId,
          chunkId: chunk.id,
          embedding: embeddings[index],
        })),
      );
      await tx
        .update(documentEmbeddingGenerations)
        .set({ status: "succeeded", completedAt: new Date() })
        .where(eq(documentEmbeddingGenerations.id, embeddingGenerationId));
      await tx.insert(auditEvents).values({
        organizationId: command.organizationId,
        actorUserId: command.userId,
        eventType: "document.indexed",
        entityType: "document_version",
        entityId: documentVersionId,
        metadata: {
          extractionId,
          embeddingGenerationId,
          chunkCount: persistedChunks.length,
        },
      });
    });
  } catch (error) {
    await db
      .update(documentEmbeddingGenerations)
      .set({
        status: "failed",
        errorCode: "embedding_failed",
        errorMessage: errorMessage(error),
        completedAt: new Date(),
      })
      .where(eq(documentEmbeddingGenerations.id, embeddingGenerationId));
    throw toProcessingError(error, "Document embedding failed");
  }

  return { documentId, documentVersionId, extractionId, embeddingGenerationId };
}

export async function listOrganizationDocuments(
  userId: string,
  organizationId: string,
) {
  await assertCanAccessOrganization(userId, organizationId);
  return db
    .select({ document: documents, version: documentVersions })
    .from(documents)
    .leftJoin(documentVersions, eq(documents.currentVersionId, documentVersions.id))
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.createdAt));
}

export async function archiveOrganizationDocument(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  await assertCanContributeToOrganization(userId, organizationId);
  const [document] = await db
    .update(documents)
    .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organizationId),
      ),
    )
    .returning();
  if (!document) throw new ApiError(404, "Document not found");
  await db.insert(auditEvents).values({
    organizationId,
    actorUserId: userId,
    eventType: "document.archived",
    entityType: "document",
    entityId: documentId,
    metadata: {},
  });
  return document;
}

async function markProcessingFailed(input: {
  extractionId: string;
  embeddingGenerationId: string;
  error: unknown;
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(documentExtractions)
      .set({
        status: "failed",
        errorCode: "extraction_failed",
        errorMessage: errorMessage(input.error),
        completedAt: new Date(),
      })
      .where(eq(documentExtractions.id, input.extractionId));
    await tx
      .update(documentEmbeddingGenerations)
      .set({
        status: "failed",
        errorCode: "extraction_failed",
        errorMessage: "Embedding skipped because extraction failed",
        completedAt: new Date(),
      })
      .where(eq(documentEmbeddingGenerations.id, input.embeddingGenerationId));
  });
}

const supabaseDocumentStorage: DocumentStorage = {
  async upload({ bucket, path, bytes, contentType }) {
    const { error } = await getSupabaseAdminClient()
      .storage.from(bucket)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new ApiError(502, `Document upload failed: ${error.message}`);
  },
  async remove({ bucket, path }) {
    const { error } = await getSupabaseAdminClient().storage.from(bucket).remove([path]);
    if (error) console.warn(`Could not clean up ${path}: ${error.message}`);
  },
};

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "document";
}

function parserKindForMime(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf-parse";
  if (mimeType.includes("wordprocessingml")) return "mammoth";
  return "plain-text";
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 2_000) : "Unknown error";
}

function toProcessingError(error: unknown, fallback: string) {
  return error instanceof ApiError
    ? error
    : new ApiError(422, `${fallback}: ${errorMessage(error)}`);
}
