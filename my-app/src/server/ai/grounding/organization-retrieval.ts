import { createHash } from "node:crypto";
import { retrieveDocumentEvidence } from "../../documents/retrieval";
import type { GroundingContextItem } from "./types";

export async function retrieveOrganizationContext(input: {
  userId: string;
  organizationId: string;
  documentVersionIds: string[];
  queryUnitId: string;
  query: string;
  limit?: number;
}): Promise<GroundingContextItem[]> {
  const evidence = await retrieveDocumentEvidence({
    userId: input.userId,
    organizationId: input.organizationId,
    selectedDocumentVersionIds: input.documentVersionIds,
    query: input.query,
    limit: input.limit,
  });
  return evidence.map((row, index) => ({
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
    },
  }));
}
