import { createHash, randomUUID } from "node:crypto";
import { db } from "@/src/db";
import {
  actionPlans,
  artifactRevisionDocumentSources,
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
  uploadSessionResults,
  uploadSessions,
} from "@/src/db/schema";
import { getSupabaseAdminClient } from "../supabase-admin";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import * as z from "zod";
import { ApiError } from "../api/errors";
import { hasOrganizationCapability } from "../auth/capabilities";
import { requireOrganizationCapability } from "../auth/capability-service";
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
import { createUploadSession, verifyUploadedObject } from "@/src/server/uploads";
import { MAX_DOCUMENT_BYTES, SUPPORTED_DOCUMENT_TYPES } from "./document-config";
import { getCursorCodec } from "../api/pagination";
import { unionAll } from "drizzle-orm/pg-core";
import {
  deriveDocumentUsageLabels,
  type DocumentUsageLabel,
} from "./usage";
import type {
  DocumentDto,
  DocumentListQuery,
} from "@/src/contracts/documents";
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
  await requireOrganizationCapability(
    command.userId,
    command.organizationId,
    "documents:write",
  );
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
        modelRevision: embeddingProvider.modelRevision,
        dimensions: embeddingProvider.dimensions,
        retrievalInstructionId: embeddingProvider.retrievalInstructionId,
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
  await requireOrganizationCapability(
    command.userId,
    command.organizationId,
    "documents:write",
  );
  validateDocumentUpload({
    fileName: command.fileName,
    mimeType: command.mimeType,
    byteSize: command.bytes.byteLength,
  });
  const existing = await db.query.documents.findFirst({ columns: { id: true, organizationId: true, title: true, status: true, version: true, currentVersionId: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.id, command.documentId),
      eq(table.organizationId, command.organizationId),
      eq(table.status, "active"),
    )) ?? operators.sql`true` },
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
      const latest = await tx.query.documentVersions.findFirst({ columns: { id: true, documentId: true, versionNumber: true, fileName: true, mimeType: true, byteSize: true, storageBucket: true, storagePath: true, contentHash: true, uploadedBy: true, createdAt: true, archivedAt: true },
        where: { RAW: (table, operators) => (eq(table.documentId, command.documentId)) ?? operators.sql`true` },
        orderBy: { versionNumber: "desc" },
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
        modelRevision: embeddingProvider.modelRevision,
        dimensions: embeddingProvider.dimensions,
        retrievalInstructionId: embeddingProvider.retrievalInstructionId,
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
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  return db
    .select({ document: documents, version: documentVersions })
    .from(documents)
    .leftJoin(documentVersions, eq(documents.currentVersionId, documentVersions.id))
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.createdAt));
}

type CurrentDocumentRow = {
  document: Pick<
    typeof documents.$inferSelect,
    "id" | "title" | "status" | "createdAt"
  >;
  version: Pick<
    typeof documentVersions.$inferSelect,
    "id" | "mimeType" | "byteSize" | "fileName" | "storageBucket" | "storagePath"
  >;
  extraction: Pick<
    typeof documentExtractions.$inferSelect,
    "id" | "status"
  > | null;
  embedding: Pick<
    typeof documentEmbeddingGenerations.$inferSelect,
    "id" | "status"
  > | null;
};

function toDocumentDto(row: CurrentDocumentRow): DocumentDto {
  const indexStatus: DocumentDto["indexStatus"] =
    row.extraction?.status === "failed" || row.embedding?.status === "failed"
      ? "failed"
      : row.extraction?.status === "succeeded" &&
          row.embedding?.status === "succeeded"
        ? "indexed"
        : "processing";

  return {
    id: row.document.id,
    title: row.document.title,
    mimeType: row.version.mimeType,
    byteSize: row.version.byteSize,
    uploadedAt: row.document.createdAt.toISOString(),
    status: row.document.status,
    indexStatus,
  };
}

function documentCursorScope(
  organizationId: string,
  status: DocumentListQuery["status"],
  search?: string,
) {
  return `organization-documents:${JSON.stringify({
    organizationId,
    status,
    search: search?.toLowerCase() ?? "",
  })}`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function loadProcessingRows(versionIds: string[]) {
  if (!versionIds.length) {
    return new Map<
      string,
      {
        extraction: CurrentDocumentRow["extraction"];
        embedding: CurrentDocumentRow["embedding"];
      }
    >();
  }

  const rows = await db
    .select({
      versionId: documentVersions.id,
      extraction: {
        id: documentExtractions.id,
        status: documentExtractions.status,
      },
      embedding: {
        id: documentEmbeddingGenerations.id,
        status: documentEmbeddingGenerations.status,
      },
    })
    .from(documentVersions)
    .leftJoin(
      documentExtractions,
      eq(documentExtractions.documentVersionId, documentVersions.id),
    )
    .leftJoin(
      documentEmbeddingGenerations,
      eq(documentEmbeddingGenerations.extractionId, documentExtractions.id),
    )
    .where(inArray(documentVersions.id, versionIds))
    .orderBy(
      desc(documentExtractions.createdAt),
      desc(documentEmbeddingGenerations.createdAt),
    );

  const byVersion = new Map<
    string,
    {
      extraction: CurrentDocumentRow["extraction"];
      embedding: CurrentDocumentRow["embedding"];
    }
  >();
  for (const row of rows) {
    if (!byVersion.has(row.versionId)) {
      byVersion.set(row.versionId, {
        extraction: row.extraction?.id ? row.extraction : null,
        embedding: row.embedding?.id ? row.embedding : null,
      });
    }
  }
  return byVersion;
}

export async function listOrganizationDocumentDtos(input: {
  userId: string;
  organizationId: string;
  query: DocumentListQuery;
}) {
  const membership = await requireOrganizationCapability(
    input.userId,
    input.organizationId,
    "documents:read",
  );
  const { status, search, limit } = input.query;
  const cursorScope = documentCursorScope(
    input.organizationId,
    status,
    search,
  );
  const cursor = input.query.cursor
    ? z
        .tuple([z.iso.datetime(), z.uuid()])
        .parse(getCursorCodec().decode(input.query.cursor, cursorScope))
    : null;
  const searchPredicate = search
    ? sql`${documents.title} ilike ${`%${escapeLikePattern(search)}%`} escape '\\'`
    : undefined;

  const pagePromise = db
    .select({
      document: {
        id: documents.id,
        title: documents.title,
        status: documents.status,
        createdAt: documents.createdAt,
      },
      version: {
        id: documentVersions.id,
        mimeType: documentVersions.mimeType,
        byteSize: documentVersions.byteSize,
        fileName: documentVersions.fileName,
        storageBucket: documentVersions.storageBucket,
        storagePath: documentVersions.storagePath,
      },
    })
    .from(documents)
    .innerJoin(
      documentVersions,
      eq(documents.currentVersionId, documentVersions.id),
    )
    .where(
      and(
        eq(documents.organizationId, input.organizationId),
        status === "all" ? undefined : eq(documents.status, status),
        searchPredicate,
        cursor
          ? or(
              lt(documents.createdAt, new Date(cursor[0])),
              and(
                eq(documents.createdAt, new Date(cursor[0])),
                lt(documents.id, cursor[1]),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(documents.createdAt), desc(documents.id))
    .limit(limit + 1);

  const countsPromise = db
    .select({
      all: sql<number>`count(*)::int`,
      active:
        sql<number>`count(*) filter (where ${documents.status} = 'active')::int`,
      archived:
        sql<number>`count(*) filter (where ${documents.status} = 'archived')::int`,
    })
    .from(documents)
    .where(eq(documents.organizationId, input.organizationId));

  const [pageRows, countRows] = await Promise.all([
    pagePromise,
    countsPromise,
  ]);
  const page = pageRows.slice(0, limit);
  const processing = await loadProcessingRows(
    page.map((row) => row.version.id),
  );
  const last = page.at(-1);

  return {
    documents: page.map((row) =>
      toDocumentDto({
        ...row,
        ...(processing.get(row.version.id) ?? {
          extraction: null,
          embedding: null,
        }),
      }),
    ),
    permissions: {
      canUpload: hasOrganizationCapability(membership.role, "documents:write"),
      canArchive: hasOrganizationCapability(
        membership.role,
        "documents:archive",
      ),
      canRestore: hasOrganizationCapability(
        membership.role,
        "documents:archive",
      ),
      canRetryIndexing: hasOrganizationCapability(
        membership.role,
        "documents:write",
      ),
    },
    counts: countRows[0] ?? { all: 0, active: 0, archived: 0 },
    nextCursor:
      pageRows.length > limit && last
        ? getCursorCodec().encode(cursorScope, [
            last.document.createdAt.toISOString(),
            last.document.id,
          ])
        : undefined,
  };
}

async function getCurrentDocumentRow(
  organizationId: string,
  documentId: string,
) {
  const [base] = await db
    .select({
      document: {
        id: documents.id,
        title: documents.title,
        status: documents.status,
        createdAt: documents.createdAt,
      },
      version: {
        id: documentVersions.id,
        mimeType: documentVersions.mimeType,
        byteSize: documentVersions.byteSize,
        fileName: documentVersions.fileName,
        storageBucket: documentVersions.storageBucket,
        storagePath: documentVersions.storagePath,
      },
    })
    .from(documents)
    .innerJoin(
      documentVersions,
      eq(documents.currentVersionId, documentVersions.id),
    )
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!base) return null;
  const processing = await loadProcessingRows([base.version.id]);
  return {
    ...base,
    ...(processing.get(base.version.id) ?? {
      extraction: null,
      embedding: null,
    }),
  } satisfies CurrentDocumentRow;
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
  const membership = await requireOrganizationCapability(
    userId,
    organizationId,
    "documents:read",
  );
  return getOrganizationDocumentLibraryPreauthorized(
    membership,
    organizationId,
    options,
  );
}

export async function getOrganizationDocumentLibraryPreauthorized(
  membership: Awaited<ReturnType<typeof requireOrganizationCapability>>,
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
    membership.status !== "active" ||
    !hasOrganizationCapability(membership.role, "documents:read")
  ) {
    throw new ApiError(403, "Active organization membership required");
  }
  const limit = Math.max(1, Math.min(100, options.limit ?? 100));
  const scope = `organization-documents:${organizationId}`;
  const cursor = options.cursor
    ? z.tuple([z.iso.datetime(), z.uuid()]).parse(getCursorCodec().decode(options.cursor, scope))
    : null;
  const documentPageRows = await db.query.documents.findMany({ columns: { id: true, organizationId: true, title: true, status: true, version: true, currentVersionId: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true },
    where: { RAW: (table, operators) => (and(
      eq(table.organizationId, organizationId),
      options.documentId ? eq(table.id, options.documentId) : undefined,
      cursor ? or(lt(table.createdAt, new Date(cursor[0])), and(eq(table.createdAt, new Date(cursor[0])), lt(table.id, cursor[1]))) : undefined,
    )) ?? operators.sql`true` },
    orderBy: { createdAt: "desc", id: "desc" },
    limit: options.documentId ? 1 : limit + 1,
  });
  const documentPage = documentPageRows.slice(0, limit);
  const documentIds = documentPage.map((document) => document.id);
  const [rows, usageRows] = documentIds.length
    ? await Promise.all([
        db
          .select({
            document: documents,
            version: documentVersions,
            extraction: documentExtractions,
            embedding: documentEmbeddingGenerations,
          })
          .from(documents)
          .leftJoin(
            documentVersions,
            eq(documentVersions.documentId, documents.id),
          )
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
          .where(inArray(documents.id, documentIds))
          .orderBy(
            desc(documents.createdAt),
            desc(documentVersions.versionNumber),
          ),
        options.includeUsage === false
          ? Promise.resolve([])
          : loadDocumentUsageRows(organizationId, documentIds),
      ])
    : [[], []];

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
      eligibleForAnalysisCycle: boolean;
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
        eligibleForAnalysisCycle:
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
  return buildDocumentUsageQuery(organizationId, documentVersionIds);
}

export function buildDocumentUsageQuery(
  organizationId: string,
  documentVersionIds: string[],
) {
  const artifactUsage = db
    .select({
      usageKind: sql<"artifact" | "draft" | "plan">`'artifact'`.as(
        "usage_kind",
      ),
      documentVersionId: artifactRevisionDocumentSources.documentVersionId,
      revisionId: sql<string | null>`${generatedArtifactRevisions.id}`.as(
        "revision_id",
      ),
      currentRevisionId: generatedArtifacts.currentRevisionId,
      acceptedRevisionId: generatedArtifacts.acceptedRevisionId,
    })
    .from(artifactRevisionDocumentSources)
    .innerJoin(
      generatedArtifactRevisions,
      eq(
        artifactRevisionDocumentSources.artifactRevisionId,
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
        inArray(
          artifactRevisionDocumentSources.documentVersionId,
          documentVersionIds,
        ),
      ),
    );
  const draftUsage = db
    .select({
      usageKind: sql<"artifact" | "draft" | "plan">`'draft'`.as("usage_kind"),
      documentVersionId:
        gapReassessmentDraftDocuments.documentVersionId,
      revisionId: sql<string | null>`null`.as("revision_id"),
      currentRevisionId: sql<string | null>`null`.as("current_revision_id"),
      acceptedRevisionId: sql<string | null>`null`.as("accepted_revision_id"),
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
      usageKind: sql<"artifact" | "draft" | "plan">`'plan'`.as("usage_kind"),
      documentVersionId: artifactRevisionDocumentSources.documentVersionId,
      revisionId: sql<string | null>`null`.as("revision_id"),
      currentRevisionId: sql<string | null>`null`.as("current_revision_id"),
      acceptedRevisionId: sql<string | null>`null`.as("accepted_revision_id"),
    })
    .from(actionPlans)
    .innerJoin(
      artifactRevisionDocumentSources,
      eq(
        actionPlans.sourceGapArtifactRevisionId,
        artifactRevisionDocumentSources.artifactRevisionId,
      ),
    )
    .where(
      and(
        eq(actionPlans.organizationId, organizationId),
        eq(actionPlans.status, "active"),
        inArray(artifactRevisionDocumentSources.documentVersionId, documentVersionIds),
      ),
    );

  return unionAll(artifactUsage, draftUsage, planUsage);
}

export async function getOrganizationDocumentDetail(userId: string, organizationId: string, documentId: string) {
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  const row = await getCurrentDocumentRow(organizationId, documentId);
  return row ? toDocumentDto(row) : null;
}

export async function listOrganizationDocumentVersions(userId: string, organizationId: string, documentId: string) {
  return (await listOrganizationDocumentVersionsPage({ userId, organizationId, documentId, limit: 100 }))?.versions ?? null;
}

export async function listOrganizationDocumentVersionsPage(input: { userId: string; organizationId: string; documentId: string; limit: number; cursor?: string }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "documents:read");
  const document = await db.query.documents.findFirst({ columns: { id: true, organizationId: true, title: true, status: true, version: true, currentVersionId: true, createdBy: true, createdAt: true, updatedAt: true, archivedAt: true }, where: { RAW: (table, operators) => (and(eq(table.id, input.documentId), eq(table.organizationId, input.organizationId))) ?? operators.sql`true` } });
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
    db.select({ documentVersionId: artifactRevisionDocumentSources.documentVersionId, revisionId: generatedArtifactRevisions.id, currentRevisionId: generatedArtifacts.currentRevisionId, acceptedRevisionId: generatedArtifacts.acceptedRevisionId })
      .from(artifactRevisionDocumentSources)
      .innerJoin(generatedArtifactRevisions, eq(artifactRevisionDocumentSources.artifactRevisionId, generatedArtifactRevisions.id))
      .innerJoin(generatedArtifacts, eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id))
      .where(and(eq(generatedArtifacts.organizationId, input.organizationId), eq(generatedArtifacts.artifactType, "gap_analysis_result"), inArray(artifactRevisionDocumentSources.documentVersionId, versionIds))),
    db.select({ documentVersionId: gapReassessmentDraftDocuments.documentVersionId }).from(gapReassessmentDraftDocuments)
      .innerJoin(gapReassessmentDrafts, eq(gapReassessmentDraftDocuments.draftId, gapReassessmentDrafts.id))
      .where(and(eq(gapReassessmentDrafts.organizationId, input.organizationId), inArray(gapReassessmentDrafts.status, ["open", "locked", "failed"]), inArray(gapReassessmentDraftDocuments.documentVersionId, versionIds))),
    db.select({ documentVersionId: artifactRevisionDocumentSources.documentVersionId }).from(actionPlans)
      .innerJoin(artifactRevisionDocumentSources, eq(actionPlans.sourceGapArtifactRevisionId, artifactRevisionDocumentSources.artifactRevisionId))
      .where(and(eq(actionPlans.organizationId, input.organizationId), eq(actionPlans.status, "active"), inArray(artifactRevisionDocumentSources.documentVersionId, versionIds))),
  ]) : [[], [], []];
  const draftVersionIds = new Set(draftSources.map((row) => row.documentVersionId));
  const activePlanVersionIds = new Set(planSources.map((row) => row.documentVersionId));
  const versions = page.map((row) => ({
    ...row,
    usage: deriveDocumentUsageLabels({ versionId: row.version.id, artifactSources, draftVersionIds, activePlanVersionIds }),
    eligibleForAnalysisCycle: document.status === "active" && document.currentVersionId === row.version.id && !row.version.archivedAt && row.embedding?.status === "succeeded",
  }));
  const last = page.at(-1)?.version;
  return { versions, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.versionNumber, last.id]) : undefined };
}

export async function getOrganizationDocumentVersion(userId: string, organizationId: string, versionId: string) {
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  const [row] = await db.select({ version: documentVersions, document: documents, extraction: documentExtractions, embedding: documentEmbeddingGenerations })
    .from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .leftJoin(documentExtractions, eq(documentExtractions.documentVersionId, documentVersions.id))
    .leftJoin(documentEmbeddingGenerations, eq(documentEmbeddingGenerations.extractionId, documentExtractions.id))
    .where(and(eq(documentVersions.id, versionId), eq(documents.organizationId, organizationId))).limit(1);
  return row ?? null;
}

export async function createDocumentSourceAccess(
  userId: string,
  organizationId: string,
  documentId: string,
  options: {
    mode?: "download" | "inline";
    page?: number;
  } = {},
) {
  await requireOrganizationCapability(userId, organizationId, "documents:read");
  const row = await getCurrentDocumentRow(organizationId, documentId);
  if (!row) {
    throw new ApiError(
      404,
      "Document not found",
      undefined,
      "DOCUMENT_NOT_FOUND",
    );
  }
  try {
    const source = getSupabaseAdminClient().storage.from(
      row.version.storageBucket,
    );
    const { data, error } =
      options.mode === "inline"
        ? await source.createSignedUrl(row.version.storagePath, 300)
        : await source.createSignedUrl(row.version.storagePath, 300, {
            download: sanitizeFileName(row.version.fileName),
          });
    if (error || !data?.signedUrl) throw new Error("Signing failed");
    const page =
      row.version.mimeType === "application/pdf" &&
      Number.isInteger(options.page) &&
      (options.page ?? 0) > 0
        ? options.page
        : undefined;
    const url = new URL(data.signedUrl);
    if (page) url.hash = `page=${page}`;
    return {
      url: url.toString(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  } catch {
    throw new ApiError(
      502,
      "Document source access could not be created",
      undefined,
      "SOURCE_ACCESS_FAILED",
    );
  }
}

export async function updateOrganizationDocument(input: { userId: string; organizationId: string; documentId: string; title: string; expectedVersion: number }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "documents:write");
  const title = input.title.trim();
  if (!title) throw new ApiError(400, "A document title is required", undefined, "DOCUMENT_TITLE_REQUIRED");
  const [document] = await db.update(documents).set({ title, version: input.expectedVersion + 1, updatedAt: new Date() }).where(and(
    eq(documents.id, input.documentId), eq(documents.organizationId, input.organizationId), eq(documents.version, input.expectedVersion),
  )).returning();
  if (!document) throw new ApiError(412, "The document changed", undefined, "PRECONDITION_FAILED");
  return document;
}

export async function restoreOrganizationDocument(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  await requireOrganizationCapability(
    userId,
    organizationId,
    "documents:archive",
  );
  const changed = await db.transaction(async (tx) => {
    const [document] = await tx
      .update(documents)
      .set({
        status: "active",
        archivedAt: null,
        version: sql`${documents.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          eq(documents.status, "archived"),
        ),
      )
      .returning({ id: documents.id });
    if (document) {
      await tx.insert(auditEvents).values({
        organizationId,
        actorUserId: userId,
        eventType: "document.restored",
        entityType: "document",
        entityId: documentId,
        metadata: {},
      });
    }
    return Boolean(document);
  });
  const row = await getCurrentDocumentRow(organizationId, documentId);
  if (!row) {
    throw new ApiError(
      404,
      "Document not found",
      undefined,
      "DOCUMENT_NOT_FOUND",
    );
  }
  if (!changed && row.document.status !== "active") {
    throw new ApiError(409, "Document could not be restored");
  }
  return toDocumentDto(row);
}

export async function archiveOrganizationDocument(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  await requireOrganizationCapability(
    userId,
    organizationId,
    "documents:archive",
  );
  const changed = await db.transaction(async (tx) => {
    const [document] = await tx
      .update(documents)
      .set({
        status: "archived",
        archivedAt: new Date(),
        version: sql`${documents.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          eq(documents.status, "active"),
        ),
      )
      .returning({ id: documents.id });
    if (document) {
      await tx.insert(auditEvents).values({
        organizationId,
        actorUserId: userId,
        eventType: "document.archived",
        entityType: "document",
        entityId: documentId,
        metadata: {},
      });
    }
    return Boolean(document);
  });
  const row = await getCurrentDocumentRow(organizationId, documentId);
  if (!row) {
    throw new ApiError(
      404,
      "Document not found",
      undefined,
      "DOCUMENT_NOT_FOUND",
    );
  }
  if (!changed && row.document.status !== "archived") {
    throw new ApiError(409, "Document could not be archived");
  }
  return toDocumentDto(row);
}

export async function createDocumentUploadSession(input: {
  userId: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
}) {
  await requireOrganizationCapability(
    input.userId,
    input.organizationId,
    "documents:write",
  );
  return createUploadSession({
    organizationId: input.organizationId,
    userId: input.userId,
    scope: "document:new",
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
  const verified = await verifyUploadedObject({ sessionId: input.sessionId, userId: input.userId, verifyObject: verifyDocumentObject });
  if (verified.organizationId !== input.organizationId || verified.scope !== "document:new") {
    throw new ApiError(404, "Upload session not found", undefined, "UPLOAD_SESSION_NOT_FOUND");
  }
  if (verified.state === "completed") {
    const completedResult = await db.query.uploadSessionResults.findFirst({
      where: { RAW: (table, operators) => (eq(table.sessionId, verified.id)) ?? operators.sql`true` },
      columns: { documentVersionId: true },
    });
    const documentVersionId = completedResult?.documentVersionId;
    if (!documentVersionId) throw new ApiError(409, "Completed upload result is unavailable", undefined, "UPLOAD_RESULT_MISSING");
    const version = await db.query.documentVersions.findFirst({ columns: { id: true, documentId: true }, where: { RAW: (table, operators) => (eq(table.id, documentVersionId)) ?? operators.sql`true` } });
    const row = version ? await getCurrentDocumentRow(input.organizationId, version.documentId) : null;
    if (!row) throw new ApiError(409, "Completed upload result is unavailable", undefined, "UPLOAD_RESULT_MISSING");
    return {
      document: toDocumentDto(row),
      internalResultId: documentVersionId,
      replayed: true,
    };
  }
  const { bytes } = await downloadDocumentObject(verified.bucket, verified.objectPath);
  const embeddingProvider = createDocumentEmbeddingProvider();
  const documentId = randomUUID();
  const documentVersionId = randomUUID();
  const extractionId = randomUUID();
  const embeddingGenerationId = randomUUID();
  await db.transaction(async (tx) => {
    const [locked] = await tx.select({
      id: uploadSessions.id,
      fileName: uploadSessions.fileName,
      bucket: uploadSessions.bucket,
      objectPath: uploadSessions.objectPath,
      actualMimeType: uploadSessions.actualMimeType,
      actualSize: uploadSessions.actualSize,
      actualSha256: uploadSessions.actualSha256,
    }).from(uploadSessions).where(and(
      eq(uploadSessions.id, verified.id), eq(uploadSessions.state, "verified"),
    )).limit(1).for("update");
    if (!locked?.actualSha256 || !locked.actualMimeType || !locked.actualSize) throw new ApiError(409, "Upload session is not verified");
    const title = input.title.trim();
    if (!title) throw new ApiError(400, "A document title is required", undefined, "DOCUMENT_TITLE_REQUIRED");
    await tx.insert(documents).values({ id: documentId, organizationId: input.organizationId, title, createdBy: input.userId });
    await tx.insert(documentVersions).values({
      id: documentVersionId, documentId, versionNumber: 1, fileName: locked.fileName, mimeType: locked.actualMimeType,
      byteSize: locked.actualSize, storageBucket: locked.bucket, storagePath: locked.objectPath,
      contentHash: locked.actualSha256, uploadedBy: input.userId,
    });
    await tx.update(documents).set({
      currentVersionId: documentVersionId,
      updatedAt: new Date(),
    }).where(eq(documents.id, documentId));
    await tx.insert(documentExtractions).values({
      id: extractionId, documentVersionId, parserKind: parserKindForMime(locked.actualMimeType), parserVersion: "v1", status: "processing", startedAt: new Date(),
    });
    await tx.insert(documentEmbeddingGenerations).values({
      id: embeddingGenerationId, extractionId, provider: embeddingProvider.provider, model: embeddingProvider.model,
      modelRevision: embeddingProvider.modelRevision, dimensions: embeddingProvider.dimensions,
      retrievalInstructionId: embeddingProvider.retrievalInstructionId,
      chunkingVersion: CHUNKING_VERSION, status: "pending",
    });
    await tx.update(uploadSessions).set({ state: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(uploadSessions.id, locked.id));
    await tx.insert(uploadSessionResults).values({ sessionId: locked.id, documentVersionId });
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId, actorUserId: input.userId,
      eventType: "document.uploaded",
      entityType: "document_version", entityId: documentVersionId,
      metadata: { documentId, versionNumber: 1, contentHash: locked.actualSha256, uploadSessionId: locked.id },
    });
  });
  await processDocumentVersion({
    userId: input.userId, organizationId: input.organizationId, bytes, mimeType: verified.actualMimeType!,
    documentVersionId, extractionId, embeddingGenerationId, embeddingProvider,
  });
  const row = await getCurrentDocumentRow(input.organizationId, documentId);
  if (!row) throw new ApiError(409, "Completed upload result is unavailable", undefined, "UPLOAD_RESULT_MISSING");
  return {
    document: toDocumentDto(row),
    internalResultId: documentVersionId,
    replayed: false,
  };
}

async function getCurrentProcessingRecord(
  organizationId: string,
  documentId: string,
) {
  const [row] = await db
    .select({
      document: {
        id: documents.id,
        status: documents.status,
      },
      version: {
        id: documentVersions.id,
        mimeType: documentVersions.mimeType,
        storageBucket: documentVersions.storageBucket,
        storagePath: documentVersions.storagePath,
      },
      extraction: {
        id: documentExtractions.id,
        status: documentExtractions.status,
      },
      embedding: {
        id: documentEmbeddingGenerations.id,
        status: documentEmbeddingGenerations.status,
      },
    })
    .from(documents)
    .innerJoin(
      documentVersions,
      eq(documents.currentVersionId, documentVersions.id),
    )
    .leftJoin(
      documentExtractions,
      eq(documentExtractions.documentVersionId, documentVersions.id),
    )
    .leftJoin(
      documentEmbeddingGenerations,
      eq(documentEmbeddingGenerations.extractionId, documentExtractions.id),
    )
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organizationId),
      ),
    )
    .orderBy(
      desc(documentExtractions.createdAt),
      desc(documentEmbeddingGenerations.createdAt),
    )
    .limit(1);
  return row ?? null;
}

export async function retryOrganizationDocumentIndexing(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  await requireOrganizationCapability(
    userId,
    organizationId,
    "documents:write",
  );
  const current = await getCurrentProcessingRecord(
    organizationId,
    documentId,
  );
  if (!current) {
    throw new ApiError(
      404,
      "Document not found",
      undefined,
      "DOCUMENT_NOT_FOUND",
    );
  }
  if (current.document.status === "archived") {
    throw new ApiError(
      409,
      "Restore the document before retrying indexing",
      undefined,
      "DOCUMENT_RESTORE_REQUIRED",
    );
  }
  if (
    !current.extraction ||
    !current.embedding ||
    (current.extraction.status !== "failed" &&
      current.embedding.status !== "failed")
  ) {
    const row = await getCurrentDocumentRow(organizationId, documentId);
    if (!row) {
      throw new ApiError(
        404,
        "Document not found",
        undefined,
        "DOCUMENT_NOT_FOUND",
      );
    }
    return toDocumentDto(row);
  }

  await db.insert(auditEvents).values({
    organizationId,
    actorUserId: userId,
    eventType: "document.index_retry_requested",
    entityType: "document_version",
    entityId: current.version.id,
    metadata: {
      documentId,
      extractionId: current.extraction.id,
      embeddingGenerationId: current.embedding.id,
    },
  });

  const embeddingProvider = createDocumentEmbeddingProvider();
  try {
    if (current.extraction.status === "failed") {
      const { bytes } = await downloadDocumentObject(
        current.version.storageBucket,
        current.version.storagePath,
      );
      await db.transaction(async (tx) => {
        await tx
          .delete(documentChunkEmbeddings)
          .where(
            eq(
              documentChunkEmbeddings.generationId,
              current.embedding!.id,
            ),
          );
        await tx
          .delete(documentChunks)
          .where(eq(documentChunks.extractionId, current.extraction!.id));
        await tx
          .update(documentExtractions)
          .set({
            status: "processing",
            extractedText: null,
            extractedTextHash: null,
            metadata: {},
            errorCode: null,
            errorMessage: null,
            startedAt: new Date(),
            completedAt: null,
          })
          .where(eq(documentExtractions.id, current.extraction!.id));
        await tx
          .update(documentEmbeddingGenerations)
          .set({
            status: "pending",
            errorCode: null,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
          })
          .where(
            eq(documentEmbeddingGenerations.id, current.embedding!.id),
          );
      });
      await processDocumentVersion({
        userId,
        organizationId,
        bytes,
        mimeType: current.version.mimeType,
        documentVersionId: current.version.id,
        extractionId: current.extraction.id,
        embeddingGenerationId: current.embedding.id,
        embeddingProvider,
      });
    } else {
      const chunks = await db
        .select({ id: documentChunks.id, content: documentChunks.content })
        .from(documentChunks)
        .where(eq(documentChunks.extractionId, current.extraction.id))
        .orderBy(documentChunks.chunkIndex);
      if (!chunks.length) {
        throw new ApiError(
          422,
          "Document chunks are unavailable",
          undefined,
          "DOCUMENT_CHUNKS_MISSING",
        );
      }
      await processEmbeddingStage({
        userId,
        organizationId,
        documentVersionId: current.version.id,
        extractionId: current.extraction.id,
        embeddingGenerationId: current.embedding.id,
        embeddingProvider,
        chunks,
      });
    }
  } catch (error) {
    await db.insert(auditEvents).values({
      organizationId,
      actorUserId: userId,
      eventType: "document.index_retry_failed",
      entityType: "document_version",
      entityId: current.version.id,
      metadata: {
        documentId,
        extractionId: current.extraction.id,
        embeddingGenerationId: current.embedding.id,
      },
    });
    throw error;
  }

  const row = await getCurrentDocumentRow(organizationId, documentId);
  if (!row) {
    throw new ApiError(
      404,
      "Document not found",
      undefined,
      "DOCUMENT_NOT_FOUND",
    );
  }
  return toDocumentDto(row);
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

  await processEmbeddingStage({
    userId: input.userId,
    organizationId: input.organizationId,
    documentVersionId: input.documentVersionId,
    extractionId: input.extractionId,
    embeddingGenerationId: input.embeddingGenerationId,
    embeddingProvider: input.embeddingProvider,
    chunks: persistedChunks,
  });
}

async function processEmbeddingStage(input: {
  userId: string;
  organizationId: string;
  documentVersionId: string;
  extractionId: string;
  embeddingGenerationId: string;
  embeddingProvider: DocumentEmbeddingProvider;
  chunks: Array<{ id: string; content: string }>;
}) {
  try {
    await db
      .update(documentEmbeddingGenerations)
      .set({
        status: "processing",
        errorCode: null,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      })
      .where(eq(documentEmbeddingGenerations.id, input.embeddingGenerationId));
    const embeddings = await input.embeddingProvider.embed(
      input.chunks.map((chunk) => chunk.content),
    );
    validateEmbeddings(
      embeddings,
      input.chunks.length,
      input.embeddingProvider.dimensions,
    );
    await db.transaction(async (tx) => {
      for (const [index, chunk] of input.chunks.entries()) {
        await tx
          .insert(documentChunkEmbeddings)
          .values({
            generationId: input.embeddingGenerationId,
            chunkId: chunk.id,
            embedding: embeddings[index],
          })
          .onConflictDoUpdate({
            target: [
              documentChunkEmbeddings.generationId,
              documentChunkEmbeddings.chunkId,
            ],
            set: { embedding: embeddings[index] },
          });
      }
      await tx
        .update(documentEmbeddingGenerations)
        .set({
          status: "succeeded",
          errorCode: null,
          errorMessage: null,
          completedAt: new Date(),
        })
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
          chunkCount: input.chunks.length,
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
    : new ApiError(
        422,
        fallback,
        undefined,
        "DOCUMENT_PROCESSING_FAILED",
      );
}
