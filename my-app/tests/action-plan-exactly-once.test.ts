import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPlan: vi.fn(),
  runGroundedOperation: vi.fn(),
}));

vi.mock("@/src/db", () => ({
  db: {
    query: {
      actionPlans: {
        findFirst: mocks.findPlan,
      },
    },
  },
}));
vi.mock("@/src/server/ai/grounding/gateway", () => ({
  runGroundedOperation: mocks.runGroundedOperation,
}));

import { executeActionPlanGenerationJob } from "@/src/server/action-plans/generation-service";

describe("Action Plan generation exactly-once retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the plan materialized by the same job before repeating any AI or persistence work", async () => {
    const planId = "00000000-0000-4000-8000-000000000001";
    mocks.findPlan.mockResolvedValue({ id: planId });

    await expect(
      executeActionPlanGenerationJob({
        jobId: "00000000-0000-4000-8000-000000000002",
        organizationId: "00000000-0000-4000-8000-000000000003",
        userId: "00000000-0000-4000-8000-000000000004",
        sourceGapRevisionId:
          "00000000-0000-4000-8000-000000000005",
        locale: "en",
      }),
    ).resolves.toEqual({ type: "action_plan", id: planId });

    expect(mocks.runGroundedOperation).not.toHaveBeenCalled();
    expect(mocks.findPlan).toHaveBeenCalledOnce();
  });
});
