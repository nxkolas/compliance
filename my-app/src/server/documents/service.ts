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
  uploadSessions,
} from "@/src/db/schema";
import { getSupabaseAdminClient } from "../supabase-admin";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import * as z from "zod";
import { ApiError } from "../api/errors";
import { hasOrganizationCapability } from "../auth/capabilities";
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
import { createUploadSession, verifyUploadedObject } from "../uploads/service";
import { MAX_DOCUMENT_BYTES, SUPPORTED_DOCUMENT_TYPES } from "./document-config";
import { getCursorCodec } from "../api/pagination";
import { unionAll } from "drizzle-orm/pg-core";
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
  options: {
    limit?: number;
    cursor?: string;
    documentId?: string;
    includeUsage?: boolean;
  } = {},
) {
  const membership = await assertCanAccessOrganization(userId, organizationId);
  return getOrganizationDocumentLibraryPreauthorized(
    membership,
    organizationId,
    options,
  );
}

export async function getOrganizationDocumentLibraryPreauthorized(
  membership: Awaited<ReturnType<typeof assertCanAccessOrganization>>,
  organizationId: string,
  options: {
    limit?: number;
    cursor?: string;
    documentId?: string;
    includeUsage?: boolean;
  } = {},
) {
  if (
    membership.organizationId !== organizationId ||
    membership.status !== "active"
  ) {
    throw new ApiError(403, "Active organization membership required");
  }
  const limit = Math.max(1, Math.min(100, options.limit ?? 100));
  const scope = `organization-documents:${organizationId}`;
  const cursor = options.cursor
    ? z.tuple([z.iso.datetime(), z.uuid()]).parse(getCursorCodec().decode(options.cursor, scope))
    : null;
  const documentPageRows = await db.query.documents.findMany({
    where: and(
      eq(documents.organizationId, organizationId),
      options.documentId ? eq(documents.id, options.documentId) : undefined,
      cursor ? or(lt(documents.createdAt, new Date(cursor[0])), and(eq(documents.createdAt, new Date(cursor[0])), lt(documents.id, cursor[1]))) : undefined,
    ),
    orderBy: [desc(documents.createdAt), desc(documents.id)],
    limit: options.documentId ? 1 : limit + 1,
  });
  const documentPage = documentPageRows.slice(0, limit);
  const documentIds = documentPage.map((document) => document.id);
  const [rows, usageRows] = await Promise.all([
    db
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
        eq(
          documentEmbeddingGenerations.extractionId,
          documentExtractions.id,
        ),
      )
      .where(
        documentIds.length ? inArray(documents.id, documentIds) : sql`false`,
      )
      .orderBy(
        desc(documents.createdAt),
        desc(documentVersions.versionNumber),
      ),
    options.includeUsage === false
      ? Promise.resolve([])
      : loadDocumentUsageRows(organizationId, documentIds),
  ]);

  const artifactSources = usageRows
    .filter((source) => source.usageKind === "artifact")
    .map((source) => ({
      documentVersionId: source.documentVersionId,
      revisionId: source.revisionId!,
      currentRevisionId: source.currentRevisionId,
      acceptedRevisionId: source.acceptedRevisionId,
    }));
  const draftSources = usageRows.filter(
    (source) => source.usageKind === "draft",
  );
  const planSources = usageRows.filter(
    (source) => source.usageKind === "plan",
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
    canContribute: hasOrganizationCapability(membership.role, "documents:write"),
    documents: [...documentsById.values()],
    nextCursor: !options.documentId && documentPageRows.length > limit && documentPage.length
      ? getCursorCodec().encode(scope, [documentPage.at(-1)!.createdAt.toISOString(), documentPage.at(-1)!.id])
      : undefined,
  };
}

async function loadDocumentUsageRows(
  organizationId: string,
  documentVersionIds: string[],
) {
  if (!documentVersionIds.length) {
    return [] as Array<{
      usageKind: "artifact" | "draft" | "plan";
      documentVersionId: string;
      revisionId: string | null;
      currentRevisionId: string | null;
      acceptedRevisionId: string | null;
    }>;
  }
  const artifactUsage = db
    .select({
      usageKind: sql<"artifact" | "draft" | "plan">`'artifact'`,
      documentVersionId: artifactRevisionSources.sourceId,
      revisionId: sql<string | null>`${generatedArtifactRevisions.id}`,
      currentRevisionId: generatedArtifacts.currentRevisionId,
      acceptedRevisionId: generatedArtifacts.acceptedRevisionId,
    })
    .from(artifactRevisionSources)
    .innerJoin(
      generatedArtifactRevisions,
      eq(
        artifactRevisionSources.artifactRevisionId,
        generatedArtifactRevisions.id,
      ),
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
        inArray(artifactRevisionSources.sourceId, documentVersionIds),
      ),
    );
  const draftUsage = db
    .select({
      usageKind: sql<"artifact" | "draft" | "plan">`'draft'`,
      documentVersionId:
        gapReassessmentDraftDocuments.documentVersionId,
      revisionId: sql<string | null>`null`,
      currentRevisionId: sql<string | null>`null`,
      acceptedRevisionId: sql<string | null>`null`,
    })
    .from(gapReassessmentDraftDocuments)
    .innerJoin(
      gapReassessmentDrafts,
      eq(gapReassessmentDraftDocuments.draftId, gapReassessmentDrafts.id),
    )
    .where(
      and(
        eq(gapReassessmentDrafts.organizationId, organizationId),
        inArray(gapReassessmentDrafts.status, ["open", "locked", "failed"]),
        inArray(
          gapReassessmentDraftDocuments.documentVersionId,
          documentVersionIds,
        ),
      ),
    );
  const planUsage = db
    .select({
      usageKind: sql<"artifact" | "draft" | "plan">`'plan'`,
      documentVersionId: artifactRevisionSources.sourceId,
      revisionId: sql<string | null>`null`,
      currentRevisionId: sql<string | null>`null`,
      acceptedRevisionId: sql<string | null>`null`,
    })
    .from(actionPlans)
    .innerJoin(
      artifactRevisionSources,
      eq(
        actionPlans.sourceGapArtifactRevisionId,
        artifactRevisionSources.artifactRevisionId,
      ),
    )
    .where(
      and(
        eq(actionPlans.organizationId, organizationId),
        eq(actionPlans.status, "active"),
        eq(artifactRevisionSources.sourceType, "document_version"),
        inArray(artifactRevisionSources.sourceId, documentVersionIds),
      ),
    );

  return unionAll(artifactUsage, draftUsage, planUsage);
}

export async function getOrganizationDocumentDetail(userId: string, organizationId: string, documentId: string) {
  const library = await getOrganizationDocumentLibrary(userId, organizationId, { documentId });
  return library.documents.find((entry) => entry.document.id === documentId) ?? null;
}

export async function listOrganizationDocumentVersions(userId: string, organizationId: string, documentId: string) {
  return (await listOrganizationDocumentVersionsPage({ userId, organizationId, documentId, limit: 100 }))?.versions ?? null;
}

export async function listOrganizationDocumentVersionsPage(input: { userId: string; organizationId: string; documentId: string; limit: number; cursor?: string }) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  const document = await db.query.documents.findFirst({ where: and(eq(documents.id, input.documentId), eq(documents.organizationId, input.organizationId)) });
  if (!document) return null;
  const scope = `document-versions:${input.organizationId}:${input.documentId}`;
  const cursor = input.cursor ? z.tuple([z.number().int().positive(), z.uuid()]).parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.select({ version: documentVersions, extraction: documentExtractions, embedding: documentEmbeddingGenerations })
    .from(documentVersions)
    .leftJoin(documentExtractions, eq(documentExtractions.documentVersionId, documentVersions.id))
    .leftJoin(documentEmbeddingGenerations, eq(documentEmbeddingGenerations.extractionId, documentExtractions.id))
    .where(and(eq(documentVersions.documentId, document.id), cursor ? or(lt(documentVersions.versionNumber, cursor[0]), and(eq(documentVersions.versionNumber, cursor[0]), lt(documentVersions.id, cursor[1]))) : undefined))
    .orderBy(desc(documentVersions.versionNumber), desc(documentVersions.id))
    .limit(input.limit + 1);
  const page = rows.slice(0, input.limit);
  const versionIds = page.map((row) => row.version.id);
  const [artifactSources, draftSources, planSources] = versionIds.length ? await Promise.all([
    db.select({ documentVersionId: artifactRevisionSources.sourceId, revisionId: generatedArtifactRevisions.id, currentRevisionId: generatedArtifacts.currentRevisionId, acceptedRevisionId: generatedArtifacts.acceptedRevisionId })
      .from(artifactRevisionSources)
      .innerJoin(generatedArtifactRevisions, eq(artifactRevisionSources.artifactRevisionId, generatedArtifactRevisions.id))
      .innerJoin(generatedArtifacts, eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id))
      .where(and(eq(generatedArtifacts.organizationId, input.organizationId), eq(generatedArtifacts.artifactType, "gap_analysis_result"), eq(artifactRevisionSources.sourceType, "document_version"), inArray(artifactRevisionSources.sourceId, versionIds))),
    db.select({ documentVersionId: gapReassessmentDraftDocuments.documentVersionId }).from(gapReassessmentDraftDocuments)
      .innerJoin(gapReassessmentDrafts, eq(gapReassessmentDraftDocuments.draftId, gapReassessmentDrafts.id))
      .where(and(eq(gapReassessmentDrafts.organizationId, input.organizationId), inArray(gapReassessmentDrafts.status, ["open", "locked", "failed"]), inArray(gapReassessmentDraftDocuments.documentVersionId, versionIds))),
    db.select({ documentVersionId: artifactRevisionSources.sourceId }).from(actionPlans)
      .innerJoin(artifactRevisionSources, eq(actionPlans.sourceGapArtifactRevisionId, artifactRevisionSources.artifactRevisionId))
      .where(and(eq(actionPlans.organizationId, input.organizationId), eq(actionPlans.status, "active"), eq(artifactRevisionSources.sourceType, "document_version"), inArray(artifactRevisionSources.sourceId, versionIds))),
  ]) : [[], [], []];
  const draftVersionIds = new Set(draftSources.map((row) => row.documentVersionId));
  const activePlanVersionIds = new Set(planSources.map((row) => row.documentVersionId));
  const versions = page.map((row) => ({
    ...row,
    usage: deriveDocumentUsageLabels({ versionId: row.version.id, artifactSources, draftVersionIds, activePlanVersionIds }),
    eligibleForReassessment: document.status === "active" && document.currentVersionId === row.version.id && !row.version.archivedAt && row.embedding?.status === "succeeded",
  }));
  const last = page.at(-1)?.version;
  return { versions, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.versionNumber, last.id]) : undefined };
}

export async function getOrganizationDocumentVersion(userId: string, organizationId: string, versionId: string) {
  await assertCanAccessOrganization(userId, organizationId);
  const [row] = await db.select({ version: documentVersions, document: documents, extraction: documentExtractions, embedding: documentEmbeddingGenerations })
    .from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .leftJoin(documentExtractions, eq(documentExtractions.documentVersionId, documentVersions.id))
    .leftJoin(documentEmbeddingGenerations, eq(documentEmbeddingGenerations.extractionId, documentExtractions.id))
    .where(and(eq(documentVersions.id, versionId), eq(documents.organizationId, organizationId))).limit(1);
  return row ?? null;
}

export async function createDocumentSourceAccess(userId: string, organizationId: string, versionId: string) {
  const row = await getOrganizationDocumentVersion(userId, organizationId, versionId);
  if (!row) throw new ApiError(404, "Document version not found", undefined, "DOCUMENT_VERSION_NOT_FOUND");
  const { data, error } = await getSupabaseAdminClient().storage.from(row.version.storageBucket).createSignedUrl(row.version.storagePath, 300, { download: row.version.fileName });
  if (error) throw new ApiError(502, "Document source access could not be created", undefined, "SOURCE_ACCESS_FAILED");
  return { url: data.signedUrl, expiresAt: new Date(Date.now() + 300_000).toISOString() };
}

export async function updateOrganizationDocument(input: { userId: string; organizationId: string; documentId: string; title: string; expectedVersion: number }) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const title = input.title.trim();
  if (!title) throw new ApiError(400, "A document title is required", undefined, "DOCUMENT_TITLE_REQUIRED");
  const [document] = await db.update(documents).set({ title, version: input.expectedVersion + 1, updatedAt: new Date() }).where(and(
    eq(documents.id, input.documentId), eq(documents.organizationId, input.organizationId), eq(documents.version, input.expectedVersion),
  )).returning();
  if (!document) throw new ApiError(412, "The document changed", undefined, "PRECONDITION_FAILED");
  return document;
}

export async function restoreOrganizationDocument(userId: string, organizationId: string, documentId: string, expectedVersion: number) {
  await assertCanContributeToOrganization(userId, organizationId);
  const [document] = await db.update(documents).set({ status: "active", archivedAt: null, version: sql`${documents.version} + 1`, updatedAt: new Date() }).where(and(
    eq(documents.id, documentId), eq(documents.organizationId, organizationId), eq(documents.status, "archived"), eq(documents.version, expectedVersion),
  )).returning();
  if (!document) throw new ApiError(412, "The document changed or is not archived", undefined, "PRECONDITION_FAILED");
  return document;
}

export async function archiveOrganizationDocument(
  userId: string,
  organizationId: string,
  documentId: string,
  expectedVersion: number,
) {
  await assertCanContributeToOrganization(userId, organizationId);
  const [document] = await db
    .update(documents)
    .set({ status: "archived", archivedAt: new Date(), version: sql`${documents.version} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organizationId),
        eq(documents.status, "active"),
        eq(documents.version, expectedVersion),
      ),
    )
    .returning();
  if (!document) throw new ApiError(412, "The document changed or is not active", undefined, "PRECONDITION_FAILED");
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

export async function createDocumentUploadSession(input: {
  userId: string;
  organizationId: string;
  documentId?: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  if (input.documentId) {
    const document = await db.query.documents.findFirst({ where: and(
      eq(documents.id, input.documentId), eq(documents.organizationId, input.organizationId), eq(documents.status, "active"),
    ) });
    if (!document) throw new ApiError(404, "Active document not found", undefined, "DOCUMENT_NOT_FOUND");
  }
  return createUploadSession({
    organizationId: input.organizationId,
    userId: input.userId,
    scope: input.documentId ? `document-version:${input.documentId}` : "document:new",
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
  title?: string;
  documentId?: string;
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const verified = await verifyUploadedObject({ sessionId: input.sessionId, userId: input.userId, verifyObject: verifyDocumentObject });
  const expectedScope = input.documentId ? `document-version:${input.documentId}` : "document:new";
  if (verified.organizationId !== input.organizationId || verified.scope !== expectedScope) {
    throw new ApiError(404, "Upload session not found", undefined, "UPLOAD_SESSION_NOT_FOUND");
  }
  if (verified.state === "completed" && verified.resultId) {
    const version = await db.query.documentVersions.findFirst({ where: eq(documentVersions.id, verified.resultId) });
    if (!version) throw new ApiError(409, "Completed upload result is unavailable", undefined, "UPLOAD_RESULT_MISSING");
    return { documentId: version.documentId, documentVersionId: version.id, replayed: true };
  }
  const { bytes } = await downloadDocumentObject(verified.bucket, verified.objectPath);
  const embeddingProvider = createDocumentEmbeddingProvider();
  const documentId = input.documentId ?? randomUUID();
  const documentVersionId = randomUUID();
  const extractionId = randomUUID();
  const embeddingGenerationId = randomUUID();
  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(uploadSessions).where(and(
      eq(uploadSessions.id, verified.id), eq(uploadSessions.state, "verified"),
    )).limit(1).for("update");
    if (!locked?.actualSha256 || !locked.actualMimeType || !locked.actualSize) throw new ApiError(409, "Upload session is not verified");
    let versionNumber = 1;
    if (input.documentId) {
      const document = await tx.query.documents.findFirst({ where: and(
        eq(documents.id, input.documentId), eq(documents.organizationId, input.organizationId), eq(documents.status, "active"),
      ) });
      if (!document) throw new ApiError(404, "Active document not found", undefined, "DOCUMENT_NOT_FOUND");
      const latest = await tx.query.documentVersions.findFirst({ where: eq(documentVersions.documentId, document.id), orderBy: [desc(documentVersions.versionNumber)] });
      versionNumber = (latest?.versionNumber ?? 0) + 1;
    } else {
      const title = input.title?.trim();
      if (!title) throw new ApiError(400, "A document title is required", undefined, "DOCUMENT_TITLE_REQUIRED");
      await tx.insert(documents).values({ id: documentId, organizationId: input.organizationId, title, createdBy: input.userId });
    }
    await tx.insert(documentVersions).values({
      id: documentVersionId, documentId, versionNumber, fileName: locked.fileName, mimeType: locked.actualMimeType,
      byteSize: locked.actualSize, storageBucket: locked.bucket, storagePath: locked.objectPath,
      contentHash: locked.actualSha256, uploadedBy: input.userId,
    });
    await tx.update(documents).set({
      currentVersionId: documentVersionId,
      ...(input.documentId ? { version: sql`${documents.version} + 1` } : {}),
      updatedAt: new Date(),
    }).where(eq(documents.id, documentId));
    await tx.insert(documentExtractions).values({
      id: extractionId, documentVersionId, parserKind: parserKindForMime(locked.actualMimeType), parserVersion: "v1", status: "processing", startedAt: new Date(),
    });
    await tx.insert(documentEmbeddingGenerations).values({
      id: embeddingGenerationId, extractionId, provider: embeddingProvider.provider, model: embeddingProvider.model,
      dimensions: embeddingProvider.dimensions, chunkingVersion: CHUNKING_VERSION, status: "pending",
    });
    await tx.update(uploadSessions).set({ state: "completed", resultType: "document_version", resultId: documentVersionId, completedAt: new Date(), updatedAt: new Date() }).where(eq(uploadSessions.id, locked.id));
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId, actorUserId: input.userId,
      eventType: input.documentId ? "document.version_uploaded" : "document.uploaded",
      entityType: "document_version", entityId: documentVersionId,
      metadata: { documentId, versionNumber, contentHash: locked.actualSha256, uploadSessionId: locked.id },
    });
    return { documentId, documentVersionId, versionNumber, extractionId, embeddingGenerationId, replayed: false };
  });
  await processDocumentVersion({
    userId: input.userId, organizationId: input.organizationId, bytes, mimeType: verified.actualMimeType!,
    documentVersionId, extractionId, embeddingGenerationId, embeddingProvider,
  });
  return result;
}

async function verifyDocumentObject(input: { bucket: string; objectPath: string }) {
  const downloaded = await downloadDocumentObject(input.bucket, input.objectPath);
  return { size: downloaded.bytes.byteLength, mimeType: downloaded.mimeType, sha256: sha256(downloaded.bytes) };
}

async function downloadDocumentObject(bucket: string, objectPath: string) {
  const { data, error } = await getSupabaseAdminClient().storage.from(bucket).download(objectPath);
  if (error) throw new ApiError(502, "Stored upload could not be read", undefined, "UPLOAD_VERIFICATION_FAILED");
  return { bytes: new Uint8Array(await data.arrayBuffer()), mimeType: data.type };
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
