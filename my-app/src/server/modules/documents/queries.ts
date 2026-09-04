import type { DocumentDto, DocumentListQuery } from "@/src/contracts/documents";
import { db } from "@/src/db";
import { documentVersions, documents } from "@/src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { hasOrganizationCapability } from "../../platform/auth/capabilities";
import { authorizeOrganizationRead, type OrganizationScopeExecutor } from "../../platform/auth/organization-scope";
import { getSupabaseAdminClient } from "../../platform/storage/supabase-admin";

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

export async function currentDocumentRows(organizationId: string, executor: OrganizationScopeExecutor = db) {
  return executor.select({ document: documents, version: documentVersions })
    .from(documents)
    .leftJoin(documentVersions, eq(documentVersions.id, documents.currentVersionId))
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.createdAt));
}

export function toDocumentDto(row: Awaited<ReturnType<typeof currentDocumentRows>>[number]): DocumentDto {
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

export async function requireDocument(organizationId: string, documentId: string, executor: OrganizationScopeExecutor = db) {
  const row = await executor.query.documents.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, documentId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!row) throw new ApiError(404, "Document not found", undefined, "DOCUMENT_NOT_FOUND");
  return row;
}

export async function versionIsInUnfinishedCycle(versionId: string, executor: OrganizationScopeExecutor = db) {
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
