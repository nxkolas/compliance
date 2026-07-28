import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrganizationCapability: vi.fn(),
  findArtifacts: vi.fn(),
  findUploadedDocument: vi.fn(),
  findPlans: vi.fn(),
  findApplicabilityRevision: vi.fn(),
  findActionPlanItems: vi.fn(),
}));

vi.mock("@/src/server/auth/capability-service", () => ({
  requireOrganizationCapability: mocks.requireOrganizationCapability,
}));

vi.mock("@/src/db", () => ({
  db: {
    query: {
      generatedArtifacts: { findMany: mocks.findArtifacts },
      documents: { findFirst: mocks.findUploadedDocument },
      actionPlans: { findMany: mocks.findPlans },
      generatedArtifactRevisions: {
        findFirst: mocks.findApplicabilityRevision,
      },
      actionPlanItems: { findMany: mocks.findActionPlanItems },
    },
  },
}));

import { getOrganizationProgress } from "@/src/server/organization-progress/service";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";

describe("organization progress service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrganizationCapability.mockResolvedValue({});
  });

  it("authorizes the read and derives completion from retained domain records", async () => {
    mocks.findArtifacts.mockResolvedValue([
      {
        artifactType: "affectedness_result",
        acceptedRevisionId: "applicability-revision",
      },
      {
        artifactType: "gap_analysis_result",
        acceptedRevisionId: "gap-revision",
      },
    ]);
    mocks.findUploadedDocument.mockResolvedValue({ id: "archived-document" });
    mocks.findPlans.mockResolvedValue([
      {
        id: "archived-plan",
        status: "archived",
        activatedAt: new Date("2026-07-01T12:00:00.000Z"),
      },
      {
        id: "active-plan",
        status: "active",
        activatedAt: new Date("2026-07-20T12:00:00.000Z"),
      },
    ]);
    mocks.findApplicabilityRevision.mockResolvedValue({
      outcomeCode: "important_entity",
    });
    mocks.findActionPlanItems.mockResolvedValue([
      { status: "done" },
      { status: "cancelled" },
    ]);

    const progress = await getOrganizationProgress(userId, organizationId);

    expect(mocks.requireOrganizationCapability).toHaveBeenCalledWith(
      userId,
      organizationId,
      "organizations:read",
    );
    expect(mocks.findActionPlanItems).toHaveBeenCalledOnce();
    expect(progress).toMatchObject({
      currentStep: null,
      completedCount: 6,
      totalCount: 6,
    });
  });

  it("does not query plan items when there is no active plan", async () => {
    mocks.findArtifacts.mockResolvedValue([]);
    mocks.findUploadedDocument.mockResolvedValue(undefined);
    mocks.findPlans.mockResolvedValue([]);

    const progress = await getOrganizationProgress(userId, organizationId);

    expect(mocks.findApplicabilityRevision).not.toHaveBeenCalled();
    expect(mocks.findActionPlanItems).not.toHaveBeenCalled();
    expect(progress.currentStep).toBe("welcome");
  });
});
