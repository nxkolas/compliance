import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { organizationProgressClient } from "@/src/client/organization-progress";
import { organizationProgressSchema } from "@/src/contracts/organization-progress";
import { invokeRouteContract } from "./support/route-contract";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getOrganizationProgress: vi.fn(),
}));

vi.mock("@/src/server/platform/http/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/src/server/modules/organizations", () => ({
  getOrganizationProgress: mocks.getOrganizationProgress,
}));

import { GET } from "@/app/api/organizations/[organizationId]/progress/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const progress = {
  completedCount: 2,
  totalCount: 6 as const,
  steps: [
    { key: "welcome" as const, completed: true },
    {
      key: "applicability_check" as const,
      completed: true,
    },
    { key: "gap_analysis" as const, completed: false },
    {
      key: "documents_uploaded" as const,
      completed: false,
    },
    { key: "action_plan" as const, completed: false },
    { key: "next_steps" as const, completed: false },
  ],
};

describe("organization progress route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.getOrganizationProgress.mockResolvedValue(progress);
  });

  it("returns the typed progress contract in the common envelope", async () => {
    const result = await invokeRouteContract({
      handler: GET,
      context: { params: Promise.resolve({ organizationId }) },
      request: new Request(
        `http://localhost/api/organizations/${organizationId}/progress`,
      ),
      outputSchema: z.object({ progress: organizationProgressSchema }),
    });

    expect(result.response.status).toBe(200);
    expect(result.parsed.data.progress).toEqual(progress);
    expect(mocks.getOrganizationProgress).toHaveBeenCalledWith(
      userId,
      organizationId,
    );
  });

  it("rejects malformed organization IDs before authentication", async () => {
    const response = await GET(
      new Request("http://localhost/api/organizations/not-a-uuid/progress"),
      { params: Promise.resolve({ organizationId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_ROUTE_PARAMETER" },
    });
    expect(mocks.requireApiUser).not.toHaveBeenCalled();
    expect(mocks.getOrganizationProgress).not.toHaveBeenCalled();
  });

  it("fetches and validates progress through the typed client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: { progress },
          meta: { requestId: "progress-client-test" },
        }),
      ),
    );

    const result = await organizationProgressClient.get(organizationId);

    expect(result.data.progress).toEqual(progress);
    expect(fetch).toHaveBeenCalledWith(
      `/api/organizations/${organizationId}/progress`,
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
      }),
    );
  });
});
