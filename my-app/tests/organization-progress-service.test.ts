import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  findOutputs: vi.fn(),
  findDocument: vi.fn(),
  findPlan: vi.fn(),
  findRevision: vi.fn(),
  findItems: vi.fn(),
}));

vi.mock("@/src/server/auth/capability-service", () => ({ requireOrganizationCapability: mocks.authorize }));
vi.mock("@/src/db", () => ({ db: { query: {
  analysisOutputs: { findMany: mocks.findOutputs },
  documents: { findFirst: mocks.findDocument },
  actionPlans: { findFirst: mocks.findPlan },
  analysisOutputRevisions: { findFirst: mocks.findRevision },
  actionPlanItems: { findMany: mocks.findItems },
} } }));

import { getOrganizationProgress } from "@/src/server/organization-progress/service";

describe("organization progress service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({});
    mocks.findOutputs.mockResolvedValue([]);
    mocks.findDocument.mockResolvedValue(undefined);
    mocks.findPlan.mockResolvedValue(undefined);
  });

  it("derives completion from current immutable outputs and the one plan", async () => {
    mocks.findOutputs.mockResolvedValue([
      { kind: "applicability", currentRevisionId: "app" },
      { kind: "gap", currentRevisionId: "gap" },
    ]);
    mocks.findDocument.mockResolvedValue({ id: "document" });
    mocks.findPlan.mockResolvedValue({ id: "plan" });
    mocks.findRevision.mockResolvedValue({ outcomeCode: "important_entity" });
    mocks.findItems.mockResolvedValue([{ status: "done" }, { status: "done" }]);
    const progress = await getOrganizationProgress("user", "organization");
    expect(progress.completedCount).toBe(6);
    expect(progress.steps.every((step) => step.completed)).toBe(true);
  });

  it("leaves the workflow open when no retained records exist", async () => {
    const progress = await getOrganizationProgress("user", "organization");
    expect(progress.completedCount).toBe(0);
    expect(mocks.findRevision).not.toHaveBeenCalled();
    expect(mocks.findItems).not.toHaveBeenCalled();
  });
});
