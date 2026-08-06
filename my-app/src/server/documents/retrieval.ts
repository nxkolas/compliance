import { db } from "@/src/db";
import { documentChunks, documentVersions, documents } from "@/src/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { assertCanAccessOrganization } from "../organizations/service";
import { EMBEDDING_DIMENSIONS } from "./document-config";
import {
  createDocumentEmbeddingProvider,
  type DocumentEmbeddingProvider,
  validateEmbeddings,
} from "./embeddings";
import { assertSelectedDocumentVersionScope } from "./retrieval-policy";
import { resolveOrganizationEmbeddingConfig } from "./service";

export { assertSelectedDocumentVersionScope } from "./retrieval-policy";

export function hybridScore(input: { fullTextRank: number; cosineSimilarity: number }) {
  return Math.max(0, Math.min(1, input.fullTextRank)) * 0.35 +
    Math.max(0, Math.min(1, input.cosineSimilarity)) * 0.65;
}

export async function retrieveDocumentEvidence(
  input: {
    userId: string;
    organizationId: string;
    selectedDocumentVersionIds: string[];
    query: string;
    limit?: number;
  },
  dependencies: { embeddingProvider?: DocumentEmbeddingProvider; queryEmbedding?: number[] } = {},
) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  const query = input.query.trim();
  if (!query) throw new ApiError(400, "A retrieval query is required");
  const requested = [...new Set(input.selectedDocumentVersionIds)];
  const scoped = requested.length
    ? await db.select({ id: documentVersions.id, organizationId: documentVersions.organizationId })
        .from(documentVersions)
        .where(and(eq(documentVersions.organizationId, input.organizationId), inArray(documentVersions.id, requested)))
    : [];
  const selected = assertSelectedDocumentVersionScope(input.organizationId, requested, scoped);
  if (!selected.length) return [];
  const provider =
    dependencies.embeddingProvider ??
    createDocumentEmbeddingProvider(
      (await resolveOrganizationEmbeddingConfig(input.organizationId)).provider,
    );
  const queryEmbedding = dependencies.queryEmbedding ?? (await provider.embed([query], "query"))[0];
  if (!queryEmbedding) throw new Error("Query embedding is missing");
  validateEmbeddings([queryEmbedding], 1, EMBEDDING_DIMENSIONS);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const fullTextRank = sql<number>`coalesce(ts_rank_cd(${documentChunks.searchVector}, websearch_to_tsquery('simple', ${query})), 0)`;
  const cosineSimilarity = sql<number>`(1 - (${documentChunks.embedding} OPERATOR(extensions.<=>) ${vectorLiteral}::extensions.vector))`;
  const combinedScore = sql<number>`((${fullTextRank}) * 0.35) + ((${cosineSimilarity}) * 0.65)`;
  const rows = await db.select({
    chunkId: documentChunks.id,
    documentVersionId: documentVersions.id,
    documentId: documents.id,
    documentTitle: documents.name,
    content: documentChunks.text,
    pageNumber: documentChunks.pageNumber,
    sectionLabel: documentChunks.sectionPath,
    fullTextRank,
    cosineSimilarity,
    combinedScore,
  }).from(documentChunks)
    .innerJoin(documentVersions, eq(documentVersions.id, documentChunks.documentVersionId))
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(and(
      eq(documentChunks.organizationId, input.organizationId),
      inArray(documentVersions.id, selected),
      eq(documentVersions.indexingStatus, "succeeded"),
      // Vectors are only comparable within one embedding model. Without this,
      // a partial or failed re-embedding silently mixes two vector spaces and
      // returns meaningless similarity scores instead of failing.
      eq(documentVersions.embeddingModel, provider.model),
      sql`${documentChunks.embedding} is not null`,
    ))
    .orderBy(desc(combinedScore), documentChunks.id)
    .limit(Math.max(1, Math.min(12, input.limit ?? 6)));
  return rows.map((row) => ({
    ...row,
    citationId: `DOC:${row.chunkId}`,
    fullTextRank: Number(row.fullTextRank),
    cosineSimilarity: Number(row.cosineSimilarity),
    combinedScore: Number(row.combinedScore),
  }));
}
