import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanAccessOrganization: vi.fn(),
  getGapRevisionStaleness: vi.fn(),
  loadGapAnalysisRelease: vi.fn(),
}));

vi.mock("@/src/db", () => ({
  db: {
    query: {
      actionPlans: {
        findFirst: vi.fn(async () => ({
          id: "plan",
          sourceGapArtifactRevisionId: "revision",
          outputLocale: "en",
          version: 1,
        })),
      },
      generatedArtifactRevisions: {
        findFirst: vi.fn(async () => ({ gapAnalysisReleaseId: "release" })),
      },
      actionPlanItems: {
        findMany: vi.fn(async () => [
          { id: "action", sourceFindingId: "finding", position: 1 },
        ]),
      },
      gapFindings: {
        findMany: vi.fn(async () => [
          { id: "finding", requirementVersionId: "requirement" },
        ]),
      },
    },
  },
}));

vi.mock("@/src/server/organizations/service", () => ({
  assertCanAccessOrganization: mocks.assertCanAccessOrganization,
  assertCanContributeToOrganization: vi.fn(),
}));

vi.mock("@/src/server/gap-analysis", () => ({
  getGapRevisionStaleness: mocks.getGapRevisionStaleness,
  loadGapAnalysisRelease: mocks.loadGapAnalysisRelease,
}));

import { getCurrentActionPlan } from "@/src/server/action-plans/service";

describe("Action Plan category response", () => {
  it("returns the pinned category icon", async () => {
    mocks.loadGapAnalysisRelease.mockResolvedValue({
      requirements: [
        {
          id: "requirement",
          title: "Access and personnel",
          position: 3,
          icon: "KeyRound",
        },
      ],
    });
    mocks.getGapRevisionStaleness.mockResolvedValue({ stale: false });

    const result = await getCurrentActionPlan("user", "organization");

    expect(result?.categories).toEqual([
      expect.objectContaining({
        requirementVersionId: "requirement",
        title: "Access and personnel",
        position: 3,
        icon: "KeyRound",
      }),
    ]);
  });
});
