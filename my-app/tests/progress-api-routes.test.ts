import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { actionPlansClient } from "@/src/client/action-plans";
import { gapAnalysisClient } from "@/src/client/gap-analysis";
import { actionPlanProgressSchema } from "@/src/contracts/action-plans";
import { gapQuestionnaireProgressSchema } from "@/src/contracts/gap-analysis/generation";
import { invokeRouteContract } from "./support/route-contract";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getActionPlanProgress: vi.fn(),
  getGapQuestionnaireProgress: vi.fn(),
}));

vi.mock("@/src/server/api/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("@/src/server/action-plans", () => ({
  getActionPlanProgress: mocks.getActionPlanProgress,
}));
vi.mock("@/src/server/gap-analysis", () => ({
  getGapQuestionnaireProgress: mocks.getGapQuestionnaireProgress,
}));

import { GET as getActionPlanProgress } from "@/app/api/organizations/[organizationId]/action-plan/progress/route";
import { GET as getGapProgress } from "@/app/api/organizations/[organizationId]/gap-analysis/progress/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ organizationId }) };
const gapProgress = {
  draftId: "00000000-0000-4000-8000-000000000003",
  answeredRequired: 1,
  totalRequired: 2,
  complete: false,
  questions: [
    { questionKey: "gap.question.one", required: true, answered: true },
    { questionKey: "gap.question.two", required: true, answered: false },
  ],
};
const planProgress = {
  planId: "00000000-0000-4000-8000-000000000004",
  totalCount: 4,
  statuses: { open: 1, in_progress: 1, done: 1, cancelled: 1 },
};

describe("focused progress API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.getGapQuestionnaireProgress.mockResolvedValue(gapProgress);
    mocks.getActionPlanProgress.mockResolvedValue(planProgress);
  });

  it("returns typed per-question Gap progress", async () => {
    const result = await invokeRouteContract({
      handler: getGapProgress,
      context,
      request: new Request(
        `http://localhost/api/organizations/${organizationId}/gap-analysis/progress`,
      ),
      outputSchema: z.object({ progress: gapQuestionnaireProgressSchema }),
    });

    expect(result.response.status).toBe(200);
    expect(result.parsed.data.progress).toEqual(gapProgress);
    expect(mocks.getGapQuestionnaireProgress).toHaveBeenCalledWith(
      userId,
      organizationId,
    );
  });

  it("returns typed four-status Action Plan progress", async () => {
    const result = await invokeRouteContract({
      handler: getActionPlanProgress,
      context,
      request: new Request(
        `http://localhost/api/organizations/${organizationId}/action-plan/progress`,
      ),
      outputSchema: z.object({ progress: actionPlanProgressSchema }),
    });

    expect(result.response.status).toBe(200);
    expect(result.parsed.data.progress).toEqual(planProgress);
    expect(mocks.getActionPlanProgress).toHaveBeenCalledWith(
      userId,
      organizationId,
    );
  });

  it("exposes both progress endpoints through typed clients", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        return Response.json({
          data: { progress: url.includes("gap-analysis") ? gapProgress : planProgress },
          meta: { requestId: "progress-client-test" },
        });
      }),
    );

    const [gap, plan] = await Promise.all([
      gapAnalysisClient.getQuestionnaireProgress(organizationId),
      actionPlansClient.getProgress(organizationId),
    ]);

    expect(gap.data.progress).toEqual(gapProgress);
    expect(plan.data.progress).toEqual(planProgress);
  });
});
