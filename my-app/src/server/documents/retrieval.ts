import { db } from "@/src/db";
import {
  documentChunkEmbeddings,
  documentChunks,
  documentEmbeddingGenerations,
  documentExtractions,
  documentVersions,
  documents,
} from "@/src/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { assertCanAccessOrganization } from "../organizations/service";
import {
  CHUNKING_VERSION,
  EMBEDDING_DIMENSIONS,
} from "./document-config";
import {
  createDocumentEmbeddingProvider,
  type DocumentEmbeddingProvider,
  validateEmbeddings,
} from "./embeddings";
import { assertSelectedDocumentVersionScope } from "./retrieval-policy";

export { assertSelectedDocumentVersionScope } from "./retrieval-policy";

export function hybridScore(input: {
  fullTextRank: number;
  cosineSimilarity: number;
}) {
  const lexical = Math.max(0, Math.min(1, input.fullTextRank));
  const semantic = Math.max(0, Math.min(1, input.cosineSimilarity));
  return lexical * 0.35 + semantic * 0.65;
}

export async function retrieveDocumentEvidence(
  input: {
    userId: string;
    organizationId: string;
    selectedDocumentVersionIds: string[];
    query: string;
    limit?: number;
  },
  dependencies: {
    embeddingProvider?: DocumentEmbeddingProvider;
    queryEmbedding?: number[];
  } = {},
) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  const query = input.query.trim();
  if (!query) throw new ApiError(400, "A retrieval query is required");
  const requested = [...new Set(input.selectedDocumentVersionIds)];
  const rows = requested.length
    ? await db
        .select({ id: documentVersions.id, organizationId: documents.organizationId })
        .from(documentVersions)
        .innerJoin(documents, eq(documentVersions.documentId, documents.id))
        .where(
          and(
            eq(documents.organizationId, input.organizationId),
            inArray(documentVersions.id, requested),
          ),
        )
    : [];
  const selected = assertSelectedDocumentVersionScope(
    input.organizationId,
    requested,
    rows,
  );
  const provider = dependencies.embeddingProvider ?? createDocumentEmbeddingProvider();
  if (provider.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new ApiError(500, "The configured embedding space requires re-indexing");
  }
  const queryEmbedding = dependencies.queryEmbedding ??
    (await provider.embed([query], "query"))[0];
  if (!queryEmbedding) throw new Error("Query embedding is missing");
  validateEmbeddings([queryEmbedding], 1, EMBEDDING_DIMENSIONS);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const fullTextRank = sql<number>`coalesce(ts_rank_cd(${documentChunks.searchVector}, websearch_to_tsquery('simple', ${query})), 0)`;
  const cosineSimilarity = sql<number>`(1 - (${documentChunkEmbeddings.embedding} OPERATOR(extensions.<=>) ${vectorLiteral}::extensions.vector))`;
  const combinedScore = sql<number>`((${fullTextRank}) * 0.35) + ((${cosineSimilarity}) * 0.65)`;
  const limit = Math.max(1, Math.min(12, input.limit ?? 6));
  const evidence = await db
    .select({
      chunkId: documentChunks.id,
      documentVersionId: documentVersions.id,
      documentId: documents.id,
      documentTitle: documents.title,
      content: documentChunks.content,
      pageNumber: documentChunks.pageNumber,
      sectionLabel: documentChunks.sectionLabel,
      fullTextRank,
      cosineSimilarity,
      combinedScore,
    })
    .from(documentChunks)
    .innerJoin(
      documentExtractions,
      eq(documentChunks.extractionId, documentExtractions.id),
    )
    .innerJoin(
      documentVersions,
      eq(documentExtractions.documentVersionId, documentVersions.id),
    )
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .innerJoin(
      documentEmbeddingGenerations,
      and(
        eq(documentEmbeddingGenerations.extractionId, documentExtractions.id),
        eq(documentEmbeddingGenerations.status, "succeeded"),
        eq(documentEmbeddingGenerations.provider, provider.provider),
        eq(documentEmbeddingGenerations.model, provider.model),
        eq(documentEmbeddingGenerations.dimensions, EMBEDDING_DIMENSIONS),
        eq(documentEmbeddingGenerations.chunkingVersion, CHUNKING_VERSION),
      ),
    )
    .innerJoin(
      documentChunkEmbeddings,
      and(
        eq(
          documentChunkEmbeddings.generationId,
          documentEmbeddingGenerations.id,
        ),
        eq(documentChunkEmbeddings.chunkId, documentChunks.id),
      ),
    )
    .where(
      and(
        eq(documents.organizationId, input.organizationId),
        inArray(documentVersions.id, selected),
        eq(documentExtractions.status, "succeeded"),
      ),
    )
    .orderBy(desc(combinedScore), documentChunks.id)
    .limit(limit);

  return evidence.map((row) => ({
    ...row,
    citationId: `DOC:${row.chunkId}`,
    fullTextRank: Number(row.fullTextRank),
    cosineSimilarity: Number(row.cosineSimilarity),
    combinedScore: Number(row.combinedScore),
  }));
}
