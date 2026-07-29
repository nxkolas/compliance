import { describe, expect, it, vi } from "vitest";
import { assertGapRevisionApprovable } from "@/src/server/gap-analysis/review-service";
import { calculateGapStaleness } from "@/src/server/gap-analysis/staleness";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

describe("gap review and approval", () => {
  it("allows insufficient evidence and unresolved conflicts", () => {
    expect(() =>
      assertGapRevisionApprovable({
        expectedRequirementVersionIds: ["r1"],
        findings: [actionableFinding("f1", "r1", "insufficient_evidence")],
        evidence: [],
        gaps: [atomicGap("f1")],
      }),
    ).not.toThrow();
    expect(() =>
      assertGapRevisionApprovable({
        expectedRequirementVersionIds: ["r1"],
        findings: [{ ...actionableFinding("f1", "r1", "not_fulfilled"), requiresReview: true }],
        evidence: [],
        gaps: [atomicGap("f1")],
      }),
    ).not.toThrow();
  });

  it("requires exact requirement coverage but allows fulfilled without a document", () => {
    expect(() =>
      assertGapRevisionApprovable({
        expectedRequirementVersionIds: ["r1", "r2"],
        findings: [actionableFinding("f1", "r1", "not_fulfilled")],
        evidence: [],
        gaps: [atomicGap("f1")],
      }),
    ).toThrow(/coverage/i);
    expect(() =>
      assertGapRevisionApprovable({
        expectedRequirementVersionIds: ["r1"],
        findings: [{ id: "f1", requirementVersionId: "r1", status: "fulfilled", requiresReview: false, statementBasis: { version: 1, triggeringQuestions: [] } }],
        evidence: [{ findingId: "f1", citationId: "Q:a1", sourceType: "assessment_answer" }],
        gaps: [],
      }),
    ).not.toThrow();
  });
});

function actionableFinding(
  id: string,
  requirementVersionId: string,
  status: "not_fulfilled" | "insufficient_evidence",
) {
  return {
    id,
    requirementVersionId,
    status,
    requiresReview: false,
    statementBasis: {
      version: 1,
      triggeringQuestions: [
        { stableKey: "question", sourceAssessmentAnswerId: "answer" },
      ],
    },
  };
}

function atomicGap(findingId: string) {
  return {
    findingId,
    questionStableKey: "question",
    sourceAssessmentAnswerId: "answer",
  };
}

describe("gap staleness", () => {
  it("distinguishes changed sources, newer releases, and archives", () => {
    expect(
      calculateGapStaleness({
        dependencies: [
          { kind: "assessment_revision", selectedId: "a1", currentId: "a2" },
        ],
        pinnedGapReleaseId: "g1",
        activeGapReleaseId: "g2",
        revisionArchived: false,
      }),
    ).toMatchObject({ stale: true, outdatedRelease: true, archived: false });
  });

  it("preserves assessment, document, and artifact source semantics in one projection", () => {
    expect(
      calculateGapStaleness({
        dependencies: [
          {
            kind: "assessment_revision",
            selectedId: "assessment-v1",
            currentId: "assessment-v1",
          },
          {
            kind: "document_version",
            selectedId: "document-v1",
            currentId: "document-v2",
          },
          {
            kind: "artifact_revision",
            selectedId: "artifact-v1",
            currentId: "artifact-v1",
            archived: true,
          },
        ],
        pinnedGapReleaseId: "release",
        activeGapReleaseId: "release",
        revisionArchived: false,
      }),
    ).toEqual({
      stale: true,
      outdatedRelease: false,
      archived: false,
      staleDependencies: [
        {
          kind: "document_version",
          selectedId: "document-v1",
          currentId: "document-v2",
        },
        {
          kind: "artifact_revision",
          selectedId: "artifact-v1",
          currentId: "artifact-v1",
          archived: true,
        },
      ],
    });
  });
});
