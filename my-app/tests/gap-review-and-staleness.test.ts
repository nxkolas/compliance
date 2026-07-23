import { describe, expect, it, vi } from "vitest";
import { assertGapRevisionApprovable } from "@/src/server/gap-analysis/review-service";
import { calculateGapStaleness } from "@/src/server/gap-analysis/staleness";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

describe("gap review and approval", () => {
  it("allows insufficient evidence but blocks unresolved conflicts", () => {
    expect(() =>
      assertGapRevisionApprovable({
        expectedRequirementVersionIds: ["r1"],
        findings: [{ id: "f1", requirementVersionId: "r1", status: "insufficient_evidence", requiresReview: false }],
        evidence: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertGapRevisionApprovable({
        expectedRequirementVersionIds: ["r1"],
        findings: [{ id: "f1", requirementVersionId: "r1", status: "not_fulfilled", requiresReview: true }],
        evidence: [],
      }),
    ).toThrow(/review blockers/i);
  });

  it("requires exact requirement coverage and documentary fulfilled evidence", () => {
    expect(() =>
      assertGapRevisionApprovable({
        expectedRequirementVersionIds: ["r1", "r2"],
        findings: [{ id: "f1", requirementVersionId: "r1", status: "not_fulfilled", requiresReview: false }],
        evidence: [],
      }),
    ).toThrow(/coverage/i);
    expect(() =>
      assertGapRevisionApprovable({
        expectedRequirementVersionIds: ["r1"],
        findings: [{ id: "f1", requirementVersionId: "r1", status: "fulfilled", requiresReview: false }],
        evidence: [{ findingId: "f1", citationId: "Q:a1", sourceType: "assessment_answer" }],
      }),
    ).toThrow(/documentary evidence/i);
  });
});

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
