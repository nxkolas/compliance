import { createHash } from "node:crypto";
import { retrieveDocumentEvidence } from "@/src/server/documents";
import {
  CHUNKING_VERSION,
  EMBEDDING_DIMENSIONS,
} from "@/src/server/documents/domain";
import { resolveOrganizationEmbeddingConfig } from "@/src/server/documents/service";
import type { GroundingContextItem } from "./types";
import { admitOrganizationEvidence } from "./organization-evidence-policy";

export async function retrieveOrganizationContext(input: {
  userId: string;
  organizationId: string;
  documentVersionIds: string[];
  queryUnitId: string;
  query: string;
  limit?: number;
  queryEmbedding?: number[];
}): Promise<GroundingContextItem[]> {
  const evidence = await retrieveDocumentEvidence({
    userId: input.userId,
    organizationId: input.organizationId,
    selectedDocumentVersionIds: input.documentVersionIds,
    query: input.query,
    limit: Math.max(input.limit ?? 0, 12),
  }, { queryEmbedding: input.queryEmbedding });
  const embedding = await resolveOrganizationEmbeddingConfig(
    input.organizationId,
  );
  const decision = admitOrganizationEvidence({
    operation: "gap_analysis",
    provider: embedding.provider,
    model: embedding.model,
    dimensions: EMBEDDING_DIMENSIONS,
    chunkingVersion: CHUNKING_VERSION,
    candidates: evidence.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      documentTitle: row.documentTitle,
      content: row.content,
      pageNumber: row.pageNumber,
      sectionLabel: row.sectionLabel,
      lexicalScore: row.fullTextRank,
      semanticScore: row.cosineSimilarity,
      combinedScore: row.combinedScore,
    })),
  });
  return decision.admitted.map((row, index) => ({
    channel: "organization_document",
    citationId: `DOC:${input.queryUnitId}:${row.chunkId}`,
    queryUnitId: input.queryUnitId,
    sourceId: row.chunkId,
    excerpt: row.content,
    excerptHash: createHash("sha256").update(row.content).digest("hex"),
    rank: index + 1,
    score: row.combinedScore,
    metadata: {
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      title: row.documentTitle,
      pageNumber: row.pageNumber,
      sectionPath: row.sectionLabel,
      queryHash: createHash("sha256").update(input.query).digest("hex"),
      retrievalPolicyVersion: decision.policyVersion,
      lexicalScore: row.lexicalScore,
      semanticScore: row.semanticScore,
      combinedScore: row.combinedScore,
      selectionRole: "admitted_organization_evidence",
    },
  }));
}
