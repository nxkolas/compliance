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

  it("accepts an organization-specific embedding model", () => {
    // The embedding model is per organization, and retrieval already restricts
    // candidates to the model that produced them, so a model differing from the
    // server default is expected rather than a policy violation.
    expect(() =>
      admitOrganizationEvidence({
        operation: "gap_analysis",
        provider: "self_hosted",
        model: "qwen3-embedding:4b-q4_K_M",
        dimensions: EMBEDDING_DIMENSIONS,
        chunkingVersion: CHUNKING_VERSION,
        candidates: [],
      }),
    ).not.toThrow();
  });

  it("fails closed when a global embedding invariant changes", () => {
    const base = {
      operation: "gap_analysis" as const,
      provider: EMBEDDING_PROVIDER,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      chunkingVersion: CHUNKING_VERSION,
      candidates: [],
    };
    const mismatch = expect.objectContaining({
      code: "GAP_ORG_EVIDENCE_POLICY_MISMATCH",
    });

    expect(() =>
      admitOrganizationEvidence({ ...base, dimensions: 768 }),
    ).toThrowError(mismatch);
    expect(() =>
      admitOrganizationEvidence({ ...base, chunkingVersion: "paragraph-v0" }),
    ).toThrowError(mismatch);
    expect(() =>
      admitOrganizationEvidence({ ...base, model: "" }),
    ).toThrowError(mismatch);
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
