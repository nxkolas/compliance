import { createHash, randomUUID } from "node:crypto";
import { db } from "@/src/db";
import {
  actionPlans,
  artifactRevisionSources,
  auditEvents,
  documentChunkEmbeddings,
  documentChunks,
  documentEmbeddingGenerations,
  documentExtractions,
  documentVersions,
  documents,
  gapReassessmentDraftDocuments,
  gapReassessmentDrafts,
  generatedArtifactRevisions,
  generatedArtifacts,
} from "@/src/db/schema";
import { getSupabaseAdminClient } from "../supabase-admin";
import { and, desc, eq, inArray } from "drizzle-orm";
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
import {
  deriveDocumentUsageLabels,
  type DocumentUsageLabel,
} from "./usage";
export type { DocumentUsageLabel } from "./usage";

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

export type UploadOrganizationDocumentVersionCommand = Omit<
  UploadOrganizationDocumentCommand,
  "title"
> & { documentId: string };

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

  await processDocumentVersion({
    userId: command.userId,
    organizationId: command.organizationId,
    bytes: command.bytes,
    mimeType: command.mimeType,
    documentVersionId,
    extractionId,
    embeddingGenerationId,
    embeddingProvider,
  });

  return { documentId, documentVersionId, extractionId, embeddingGenerationId };
}

export async function uploadOrganizationDocumentVersion(
  command: UploadOrganizationDocumentVersionCommand,
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
  const existing = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, command.documentId),
      eq(documents.organizationId, command.organizationId),
      eq(documents.status, "active"),
    ),
  });
  if (!existing) throw new ApiError(404, "Active document not found");

  const storage = dependencies.storage ?? supabaseDocumentStorage;
  const embeddingProvider =
    dependencies.embeddingProvider ?? createDocumentEmbeddingProvider();
  const documentVersionId = randomUUID();
  const extractionId = randomUUID();
  const embeddingGenerationId = randomUUID();
  const fileName = sanitizeFileName(command.fileName);
  const storagePath = `${command.organizationId}/${command.documentId}/${documentVersionId}/${fileName}`;
  const contentHash = sha256(command.bytes);
  await storage.upload({
    bucket: DOCUMENT_STORAGE_BUCKET,
    path: storagePath,
    bytes: command.bytes,
    contentType: command.mimeType,
  });

  let versionNumber = 0;
  try {
    await db.transaction(async (tx) => {
      const [lockedDocument] = await tx
        .update(documents)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(documents.id, command.documentId),
            eq(documents.organizationId, command.organizationId),
            eq(documents.status, "active"),
          ),
        )
        .returning({ id: documents.id });
      if (!lockedDocument) throw new ApiError(409, "Document is no longer active");
      const latest = await tx.query.documentVersions.findFirst({
        where: eq(documentVersions.documentId, command.documentId),
        orderBy: [desc(documentVersions.versionNumber)],
      });
      versionNumber = (latest?.versionNumber ?? 0) + 1;
      await tx.insert(documentVersions).values({
        id: documentVersionId,
        documentId: command.documentId,
        versionNumber,
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
        .set({ currentVersionId: documentVersionId, updatedAt: new Date() })
        .where(eq(documents.id, command.documentId));
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
        eventType: "document.version_uploaded",
        entityType: "document_version",
        entityId: documentVersionId,
        metadata: { documentId: command.documentId, versionNumber, contentHash },
      });
    });
  } catch (error) {
    await storage.remove({ bucket: DOCUMENT_STORAGE_BUCKET, path: storagePath });
    throw error;
  }

  await processDocumentVersion({
    userId: command.userId,
    organizationId: command.organizationId,
    bytes: command.bytes,
    mimeType: command.mimeType,
    documentVersionId,
    extractionId,
    embeddingGenerationId,
    embeddingProvider,
  });

  return {
    documentId: command.documentId,
    documentVersionId,
    versionNumber,
    extractionId,
    embeddingGenerationId,
  };
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

export async function getOrganizationDocumentLibrary(
  userId: string,
  organizationId: string,
) {
  const membership = await assertCanAccessOrganization(userId, organizationId);
  const rows = await db
    .select({
      document: documents,
      version: documentVersions,
      extraction: documentExtractions,
      embedding: documentEmbeddingGenerations,
    })
    .from(documents)
    .leftJoin(documentVersions, eq(documentVersions.documentId, documents.id))
    .leftJoin(
      documentExtractions,
      eq(documentExtractions.documentVersionId, documentVersions.id),
    )
    .leftJoin(
      documentEmbeddingGenerations,
      eq(documentEmbeddingGenerations.extractionId, documentExtractions.id),
    )
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.createdAt), desc(documentVersions.versionNumber));

  const artifactSources = await db
    .select({
      documentVersionId: artifactRevisionSources.sourceId,
      revisionId: generatedArtifactRevisions.id,
      currentRevisionId: generatedArtifacts.currentRevisionId,
      acceptedRevisionId: generatedArtifacts.acceptedRevisionId,
    })
    .from(artifactRevisionSources)
    .innerJoin(
      generatedArtifactRevisions,
      eq(artifactRevisionSources.artifactRevisionId, generatedArtifactRevisions.id),
    )
    .innerJoin(
      generatedArtifacts,
      eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id),
    )
    .where(
      and(
        eq(generatedArtifacts.organizationId, organizationId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
        eq(artifactRevisionSources.sourceType, "document_version"),
      ),
    );
  const draftSources = await db
    .select({ documentVersionId: gapReassessmentDraftDocuments.documentVersionId })
    .from(gapReassessmentDraftDocuments)
    .innerJoin(
      gapReassessmentDrafts,
      eq(gapReassessmentDraftDocuments.draftId, gapReassessmentDrafts.id),
    )
    .where(
      and(
        eq(gapReassessmentDrafts.organizationId, organizationId),
        inArray(gapReassessmentDrafts.status, ["open", "locked", "failed"]),
      ),
    );
  const planSources = await db
    .select({ documentVersionId: artifactRevisionSources.sourceId })
    .from(actionPlans)
    .innerJoin(
      artifactRevisionSources,
      eq(actionPlans.sourceGapArtifactRevisionId, artifactRevisionSources.artifactRevisionId),
    )
    .where(
      and(
        eq(actionPlans.organizationId, organizationId),
        eq(actionPlans.status, "active"),
        eq(artifactRevisionSources.sourceType, "document_version"),
      ),
    );

  const draftVersionIds = new Set(
    draftSources.map((source) => source.documentVersionId),
  );
  const activePlanVersionIds = new Set(
    planSources.map((source) => source.documentVersionId),
  );

  const documentsById = new Map<
    string,
    { document: typeof documents.$inferSelect; versions: Array<{
      version: typeof documentVersions.$inferSelect;
      extraction: typeof documentExtractions.$inferSelect | null;
      embedding: typeof documentEmbeddingGenerations.$inferSelect | null;
      usage: DocumentUsageLabel[];
      eligibleForReassessment: boolean;
    }> }
  >();
  for (const row of rows) {
    const entry = documentsById.get(row.document.id) ?? {
      document: row.document,
      versions: [],
    };
    if (row.version) {
      const usage = deriveDocumentUsageLabels({
        versionId: row.version.id,
        artifactSources,
        draftVersionIds,
        activePlanVersionIds,
      });
      entry.versions.push({
        version: row.version,
        extraction: row.extraction,
        embedding: row.embedding,
        usage,
        eligibleForReassessment:
          row.document.status === "active" &&
          row.document.currentVersionId === row.version.id &&
          !row.version.archivedAt &&
          row.embedding?.status === "succeeded",
      });
    }
    documentsById.set(row.document.id, entry);
  }
  return {
    role: membership.role,
    canContribute: membership.role !== "auditor",
    documents: [...documentsById.values()],
  };
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

async function processDocumentVersion(input: {
  userId: string;
  organizationId: string;
  bytes: Uint8Array;
  mimeType: string;
  documentVersionId: string;
  extractionId: string;
  embeddingGenerationId: string;
  embeddingProvider: DocumentEmbeddingProvider;
}) {
  let persistedChunks: Array<{ id: string; content: string }> = [];
  try {
    const parsed = await parseDocument(input.bytes, input.mimeType);
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
        .where(eq(documentExtractions.id, input.extractionId));
      return tx
        .insert(documentChunks)
        .values(
          chunkInputs.map((chunk) => ({
            extractionId: input.extractionId,
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
      extractionId: input.extractionId,
      embeddingGenerationId: input.embeddingGenerationId,
      error,
    });
    throw toProcessingError(error, "Document extraction failed");
  }

  try {
    await db
      .update(documentEmbeddingGenerations)
      .set({ status: "processing", startedAt: new Date() })
      .where(eq(documentEmbeddingGenerations.id, input.embeddingGenerationId));
    const embeddings = await input.embeddingProvider.embed(
      persistedChunks.map((chunk) => chunk.content),
    );
    validateEmbeddings(
      embeddings,
      persistedChunks.length,
      input.embeddingProvider.dimensions,
    );
    await db.transaction(async (tx) => {
      await tx.insert(documentChunkEmbeddings).values(
        persistedChunks.map((chunk, index) => ({
          generationId: input.embeddingGenerationId,
          chunkId: chunk.id,
          embedding: embeddings[index],
        })),
      );
      await tx
        .update(documentEmbeddingGenerations)
        .set({ status: "succeeded", completedAt: new Date() })
        .where(eq(documentEmbeddingGenerations.id, input.embeddingGenerationId));
      await tx.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "document.indexed",
        entityType: "document_version",
        entityId: input.documentVersionId,
        metadata: {
          extractionId: input.extractionId,
          embeddingGenerationId: input.embeddingGenerationId,
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
      .where(eq(documentEmbeddingGenerations.id, input.embeddingGenerationId));
    throw toProcessingError(error, "Document embedding failed");
  }
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
