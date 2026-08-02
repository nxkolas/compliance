import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPlan: vi.fn(),
  runGroundedOperation: vi.fn(),
  selectResults: [] as unknown[][],
}));

function queryBuilder(result: unknown[]) {
  const builder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  return builder;
}

vi.mock("@/src/db", () => ({
  db: {
    query: {
      actionPlans: {
        findFirst: mocks.findPlan,
      },
    },
    select: vi.fn(() => queryBuilder(mocks.selectResults.shift() ?? [])),
  },
}));
vi.mock("@/src/server/ai/grounding/gateway", () => ({
  runGroundedOperation: mocks.runGroundedOperation,
}));

import { executeActionPlanGenerationJob } from "@/src/server/action-plans/generation-service";

describe("Action Plan generation exactly-once retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults = [];
  });

  it("returns the plan materialized by the same job before repeating any AI or persistence work", async () => {
    const planId = "00000000-0000-4000-8000-000000000001";
    const jobId = "00000000-0000-4000-8000-000000000002";
    mocks.findPlan.mockResolvedValue({ id: planId, generationJobId: jobId });
    mocks.selectResults.push(
      [{ id: "item-1" }],
      [{ actionPlanItemId: "item-1", gapItemId: "gap-1" }],
      [{ id: "gap-1" }],
    );

    await expect(
      executeActionPlanGenerationJob({
        jobId,
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

  it("rejects a same-job plan whose published rows do not cover every source gap", async () => {
    const planId = "00000000-0000-4000-8000-000000000001";
    const jobId = "00000000-0000-4000-8000-000000000002";
    mocks.findPlan.mockResolvedValue({ id: planId, generationJobId: jobId });
    mocks.selectResults.push(
      [{ id: "item-1" }],
      [{ actionPlanItemId: "item-1", gapItemId: "gap-1" }],
      [{ id: "gap-1" }, { id: "gap-2" }],
    );

    await expect(
      executeActionPlanGenerationJob({
        jobId,
        organizationId: "00000000-0000-4000-8000-000000000003",
        userId: "00000000-0000-4000-8000-000000000004",
        sourceGapRevisionId: "00000000-0000-4000-8000-000000000005",
        locale: "en",
      }),
    ).rejects.toMatchObject({ code: "ACTION_PLAN_PARTIAL_STATE" });

    expect(mocks.runGroundedOperation).not.toHaveBeenCalled();
  });
});
