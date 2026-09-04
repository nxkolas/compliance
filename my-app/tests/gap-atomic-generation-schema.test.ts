import { describe, expect, it } from "vitest";
import { deriveAtomicGapKind } from "@/src/server/modules/gap-analysis/generation-schema";
import { atomicGapGroundedClaims } from "@/src/server/modules/gap-analysis/grounded-claims";

describe("atomic Gap response contract", () => {
  it("treats atomic control-state gaps as organization claims", () => {
    const [claim] = atomicGapGroundedClaims([
      {
        requirementCode: "REQ",
        statementBasis: {
          version: "1",
          triggeringQuestions: [],
          satisfiedQuestionStableKeys: [],
        },
        statementBasisHash: "hash",
        gaps: [
          {
            questionStableKey: "trigger",
            sourceAssessmentAnswerId: "00000000-0000-4000-8000-000000000001",
            kind: "missing",
            statement: "MFA is missing.",
            citationIds: ["Q:answer"],
          },
        ],
        reviewNotice: null,
        assumptions: [],
        citationIds: ["LEGAL:req"],
        contradictions: [],
        requiresReview: false,
        legalCitationId: "LEGAL:req",
      },
    ]);

    expect(claim).toMatchObject({
      kind: "organization",
      binding: false,
      citationIds: ["Q:answer"],
    });
  });

  it.each([
    ["not_implemented", false, "missing"],
    ["partially_implemented", false, "partial"],
    ["unsure", false, "uncertain"],
    ["not_applicable", true, "uncertain"],
  ] as const)(
    "derives %s as a server-owned %s gap kind",
    (answer, allNotApplicable, expected) => {
      expect(deriveAtomicGapKind(answer, allNotApplicable)).toBe(expected);
    },
  );

  it("rejects satisfied and non-triggering answers", () => {
    expect(() => deriveAtomicGapKind("fully_implemented", false)).toThrow(
      /trigger/i,
    );
    expect(() => deriveAtomicGapKind("not_applicable", false)).toThrow(
      /trigger/i,
    );
  });
});
