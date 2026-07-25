import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrganizationCapability: vi.fn(),
  loadFindingsForRevisionIds: vi.fn(),
  loadGapAnalysisRelease: vi.fn(),
  loadActiveGapAnalysisReleasePointer: vi.fn(),
  getStaleness: vi.fn(),
  revision: null as unknown,
}));

vi.mock("@/src/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ revision: mocks.revision }]),
          })),
        })),
      })),
    })),
  },
}));

vi.mock("@/src/server/auth/capability-service", () => ({
  requireOrganizationCapability: mocks.requireOrganizationCapability,
}));

vi.mock("@/src/server/gap-analysis/postgres-page-data", () => ({
  loadFindingsForRevisionIds: mocks.loadFindingsForRevisionIds,
  postgresGapPageData: {},
}));

vi.mock("@/src/server/gap-analysis/release-loader", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/src/server/gap-analysis/release-loader")
    >();
  return {
    ...actual,
    loadGapAnalysisRelease: mocks.loadGapAnalysisRelease,
    loadActiveGapAnalysisReleasePointer:
      mocks.loadActiveGapAnalysisReleasePointer,
  };
});

vi.mock("@/src/server/gap-analysis/staleness", () => ({
  getGapRevisionStalenessBatchPreauthorized: mocks.getStaleness,
}));

import { getGapAnalysisRevision } from "@/src/server/gap-analysis/workflow-reader";

describe("historical Gap revision projection", () => {
  it("uses the same safe finding projection as the current workflow", async () => {
    const requirementVersionId =
      "00000000-0000-4000-8000-000000000010";
    mocks.revision = {
      id: "00000000-0000-4000-8000-000000000020",
      gapAnalysisReleaseId: "release",
      outputLocale: "en",
      result: {
        schemaKind: "gap_revision_metadata_v1",
        outputLocale: "en",
        findingDiagnostics: [
          {
            requirementVersionId,
            contradictions: ["HISTORICAL_CONTRADICTION_SENTINEL"],
            questionnaireDisagreements: [
              "HISTORICAL_DISAGREEMENT_SENTINEL",
            ],
          },
        ],
        correctedFromRevisionId: null,
        correctedRequirementVersionIds: [],
      },
      modelName: "HISTORICAL_MODEL_SENTINEL",
    };
    mocks.loadFindingsForRevisionIds.mockResolvedValue([
      {
        finding: {
          id: "finding",
          artifactRevisionId: "revision",
          requirementVersionId,
          status: "not_fulfilled",
          rationale: "Safe rationale",
          recommendation: "Safe recommendation",
          assumptions: ["HISTORICAL_ASSUMPTION_SENTINEL"],
          requiresReview: true,
        },
        requirement: {
          id: requirementVersionId,
          code: "HISTORICAL_CODE_SENTINEL",
        },
        evidence: [
          {
            id: "evidence",
            findingId: "finding",
            citationId: "HISTORICAL_CITATION_SENTINEL",
            sourceType: "assessment_answer",
            excerpt: "HISTORICAL_EXCERPT_SENTINEL",
            pageNumber: null,
            sectionLabel: null,
          },
        ],
      },
    ]);
    mocks.loadGapAnalysisRelease.mockResolvedValue({
      id: "release",
      requirements: [
        {
          id: requirementVersionId,
          stableRequirementId: "stable",
          code: "catalogue-code",
          position: 1,
          criticality: "high",
          title: "Historical requirement",
          requirementText: "Historical text",
          legalReferences: [],
        },
      ],
    });
    mocks.loadActiveGapAnalysisReleasePointer.mockResolvedValue({
      gapAnalysisReleaseId: "release",
    });
    mocks.getStaleness.mockResolvedValue({
      accepted: { stale: false },
      candidate: null,
    });

    const result = await getGapAnalysisRevision({
      userId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      revisionId: "00000000-0000-4000-8000-000000000020",
      locale: "en",
    });
    const serialized = JSON.stringify(result);

    expect(result?.revision).toEqual({
      id: "00000000-0000-4000-8000-000000000020",
      outputLocale: "en",
    });
    expect(result?.findings[0]).toMatchObject({
      requirement: { title: "Historical requirement", position: 1 },
      hasQuestionnaireDisagreement: true,
      sources: [{ kind: "assessment", label: "Your information" }],
    });
    for (const sentinel of [
      "HISTORICAL_CONTRADICTION_SENTINEL",
      "HISTORICAL_DISAGREEMENT_SENTINEL",
      "HISTORICAL_MODEL_SENTINEL",
      "HISTORICAL_ASSUMPTION_SENTINEL",
      "HISTORICAL_CODE_SENTINEL",
      "HISTORICAL_CITATION_SENTINEL",
      "HISTORICAL_EXCERPT_SENTINEL",
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });
});
