import { describe, expect, it } from "vitest";
import {
  admitOrganizationEvidence,
  type OrganizationEvidenceCandidate,
} from "@/src/server/ai/grounding/organization-evidence-policy";
import {
  CHUNKING_VERSION,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
} from "@/src/server/documents/document-config";

const candidate = (
  chunkId: string,
  scores: {
    lexicalScore: number;
    semanticScore: number;
    combinedScore: number;
  },
): OrganizationEvidenceCandidate => ({
  chunkId,
  documentId: `document-${chunkId}`,
  documentVersionId: `version-${chunkId}`,
  documentTitle: `Evidence ${chunkId}`,
  content: `Content ${chunkId}`,
  pageNumber: null,
  sectionLabel: null,
  ...scores,
});

describe("Gap organization-evidence admission", () => {
  it("rejects unrelated top-ranked evidence and admits only calibrated relevant evidence", () => {
    const result = admitOrganizationEvidence({
      operation: "gap_analysis",
      provider: EMBEDDING_PROVIDER,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      chunkingVersion: CHUNKING_VERSION,
      candidates: [
        candidate("unrelated", {
          lexicalScore: 0.01,
          semanticScore: 0.38,
          combinedScore: 0.251,
        }),
        candidate("restore-test", {
          lexicalScore: 0.08,
          semanticScore: 0.688,
          combinedScore: 0.475,
        }),
      ],
    });

    expect(result.policyVersion).toBe("gap_org_evidence_relevance_v1");
    expect(result.admitted.map((item) => item.chunkId)).toEqual([
      "restore-test",
    ]);
    expect(result.rejected).toEqual([
      expect.objectContaining({
        chunkId: "unrelated",
        reason: "below_relevance_floor",
      }),
    ]);
  });

  it("fails closed when the indexed embedding configuration changes", () => {
    expect(() =>
      admitOrganizationEvidence({
        operation: "gap_analysis",
        provider: EMBEDDING_PROVIDER,
        model: "different-model",
        dimensions: EMBEDDING_DIMENSIONS,
        chunkingVersion: CHUNKING_VERSION,
        candidates: [],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "GAP_ORG_EVIDENCE_POLICY_MISMATCH",
      }),
    );
  });

  it("uses deterministic score and chunk tie-breaking with a bounded result", () => {
    const candidates = ["d", "b", "c", "a"].map((id) =>
      candidate(id, {
        lexicalScore: 0.2,
        semanticScore: 0.8,
        combinedScore: 0.59,
      }),
    );
    const result = admitOrganizationEvidence({
      operation: "gap_analysis",
      provider: EMBEDDING_PROVIDER,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      chunkingVersion: CHUNKING_VERSION,
      candidates,
    });

    expect(result.admitted.map((item) => item.chunkId)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(result.rejected).toEqual([
      expect.objectContaining({ chunkId: "d", reason: "result_limit" }),
    ]);
  });
});
