import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

import {
  assertGapCorrectionReasons,
  copyGapFindingEvidenceValues,
  resolveGapFindingCorrection,
} from "@/src/server/gap-analysis/review-service";

type SourceType =
  | "assessment_answer"
  | "document_chunk"
  | "legal_source_chunk";

function evidence(
  sourceType: SourceType,
  sourceId: string,
) {
  return {
    citationId: `${sourceType}:${sourceId}`,
    sourceType,
    assessmentAnswerId:
      sourceType === "assessment_answer" ? sourceId : null,
    documentChunkId: sourceType === "document_chunk" ? sourceId : null,
    legalSourceChunkId:
      sourceType === "legal_source_chunk" ? sourceId : null,
    excerpt: "Pinned excerpt",
    pageNumber: sourceType === "document_chunk" ? 2 : null,
    sectionLabel: "Section",
  };
}

describe("gap correction evidence copying", () => {
  it.each([
    ["assessment_answer", "answer-1"],
    ["document_chunk", "document-chunk-1"],
    ["legal_source_chunk", "legal-chunk-1"],
  ] as const)("preserves the %s source-specific foreign key", (type, id) => {
    expect(copyGapFindingEvidenceValues(evidence(type, id), "new-finding")).toEqual({
      findingId: "new-finding",
      ...evidence(type, id),
    });
  });

  it("copies a finding containing all three evidence source types without losing a key", () => {
    const copied = [
      evidence("assessment_answer", "answer-1"),
      evidence("document_chunk", "document-chunk-1"),
      evidence("legal_source_chunk", "legal-chunk-1"),
    ].map((item) => copyGapFindingEvidenceValues(item, "new-finding"));

    expect(copied).toHaveLength(3);
    expect(copied.map((item) => item.assessmentAnswerId)).toEqual([
      "answer-1",
      null,
      null,
    ]);
    expect(copied.map((item) => item.documentChunkId)).toEqual([
      null,
      "document-chunk-1",
      null,
    ]);
    expect(copied.map((item) => item.legalSourceChunkId)).toEqual([
      null,
      null,
      "legal-chunk-1",
    ]);
  });
});

describe("gap correction transitions", () => {
  const source = {
    id: "finding-1",
    status: "fulfilled" as const,
    evidenceSufficiency: "none" as const,
    requiresReview: false,
  };

  it.each([
    ["partially_fulfilled", "medium"],
    ["not_fulfilled", "high"],
    ["insufficient_evidence", "high"],
    ["fulfilled", "low"],
  ] as const)("supports fulfilled -> %s and derives severity", (status, severity) => {
    expect(
      resolveGapFindingCorrection({
        source,
        correction: {
          findingId: source.id,
          status,
          reason: "Reviewed by the control owner",
        },
        criticality: "high",
      }),
    ).toMatchObject({ status, severity });
  });

  it("allows an unchanged status with an edited explanation", () => {
    expect(
      resolveGapFindingCorrection({
        source,
        correction: {
          findingId: source.id,
          reason: "Clarified wording",
          rationale: "Neu",
        },
        criticality: "high",
      }).status,
    ).toBe("fulfilled");
  });

  it("requires a reason for every manual change", () => {
    expect(() =>
      assertGapCorrectionReasons([
        { findingId: source.id, reason: " " },
      ]),
    ).toThrowError(
      expect.objectContaining({ code: "GAP_CORRECTION_REASON_REQUIRED" }),
    );
  });

  it("requires a resolution reason only when a contradiction is cleared", () => {
    const conflicted = { ...source, requiresReview: true };
    expect(() =>
      resolveGapFindingCorrection({
        source: conflicted,
        correction: {
          findingId: source.id,
          requiresReview: false,
          reason: "Resolved",
        },
        criticality: "high",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "GAP_REVIEW_RESOLUTION_REQUIRED" }),
    );

    expect(
      resolveGapFindingCorrection({
        source: conflicted,
        correction: {
          findingId: source.id,
          requiresReview: false,
          reason: "Resolved",
          resolutionReason: "The policy owner confirmed the authoritative input.",
        },
        criticality: "high",
      }).requiresReview,
    ).toBe(false);
  });
});
