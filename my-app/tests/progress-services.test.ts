import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentGapDefinition } from "@/src/server/modules/gap-analysis/release/current";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  findCycle: vi.fn(),
  findPlan: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/src/server/platform/auth/organization-scope", () => ({
  authorizeOrganizationRead: mocks.authorize,
}));

import { getActionPlanProgress } from "@/src/server/modules/action-plans/progress-service";
import { getGapQuestionnaireProgress } from "@/src/server/modules/gap-analysis/progress-service";

describe("workflow progress services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.authorize.mockResolvedValue({
      executor: {
        query: {
          gapAnalysisCycles: { findFirst: mocks.findCycle },
          actionPlans: { findFirst: mocks.findPlan },
        },
        select: mocks.select,
      },
    });
  });

  it("reports answer state for every current Gap question", async () => {
    const definition = getCurrentGapDefinition("de");
    const [first, second] = definition.questions;
    mocks.findCycle.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000003",
      draftAnswers: {
        [first.stableKey]: first.options[0].stableValue,
        [second.stableKey]: "not-a-valid-option",
      },
    });

    const progress = await getGapQuestionnaireProgress("user", "organization");

    expect(progress.draftId).toBe("00000000-0000-4000-8000-000000000003");
    expect(progress.questions).toHaveLength(definition.questions.length);
    expect(progress.questions[0]).toMatchObject({
      questionKey: first.stableKey,
      answered: true,
    });
    expect(progress.questions[1]).toMatchObject({
      questionKey: second.stableKey,
      answered: false,
    });
    expect(progress.answeredRequired).toBe(1);
    expect(progress.complete).toBe(false);
    expect(mocks.authorize).toHaveBeenCalledWith({
      actorUserId: "user",
      organizationId: "organization",
      capability: "gap:read",
    });
  });

  it("returns all four Action Plan status counts", async () => {
    mocks.findPlan.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000004",
    });
    mocks.where.mockResolvedValue([
      { status: "open" },
      { status: "in_progress" },
      { status: "done" },
      { status: "done" },
      { status: "cancelled" },
    ]);

    await expect(
      getActionPlanProgress("user", "organization"),
    ).resolves.toEqual({
      planId: "00000000-0000-4000-8000-000000000004",
      totalCount: 5,
      statuses: {
        open: 1,
        in_progress: 1,
        done: 2,
        cancelled: 1,
      },
    });
  });

  it("returns zeroed Action Plan counts when no plan exists", async () => {
    mocks.findPlan.mockResolvedValue(undefined);

    await expect(
      getActionPlanProgress("user", "organization"),
    ).resolves.toEqual({
      planId: null,
      totalCount: 0,
      statuses: {
        open: 0,
        in_progress: 0,
        done: 0,
        cancelled: 0,
      },
    });
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
