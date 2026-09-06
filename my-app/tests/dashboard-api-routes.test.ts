import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { dashboardClient } from "@/src/client/dashboard";
import {
  dashboardActivityItemSchema,
  dashboardProgressHistorySchema,
} from "@/src/contracts/dashboard";
import { invokeRouteContract } from "./support/route-contract";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getOrganizationDashboard: vi.fn(),
  listDashboardActivity: vi.fn(),
  getDashboardProgressHistory: vi.fn(),
}));

vi.mock("@/src/server/platform/http/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("@/src/server/modules/organizations", () => ({
  getOrganizationDashboard: mocks.getOrganizationDashboard,
  listDashboardActivity: mocks.listDashboardActivity,
  getDashboardProgressHistory: mocks.getDashboardProgressHistory,
}));

import { GET as getActivity } from "@/app/api/organizations/[organizationId]/dashboard/activity/route";
import { GET as getDashboard } from "@/app/api/organizations/[organizationId]/dashboard/route";
import { GET as getHistory } from "@/app/api/organizations/[organizationId]/dashboard/progress-history/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ organizationId }) };
const activity = [{
  id: "00000000-0000-4000-8000-000000000003",
  code: "document_uploaded" as const,
  actor: { userId, displayName: "Maria S.", initials: "MS" },
  occurredAt: "2026-09-06T10:00:00.000Z",
  entityType: "document_version",
  entityId: "version",
  params: { documentTitle: "Policy.pdf" },
  href: `/tool/organizations/${organizationId}/documents`,
}];
const history = {
  currentPercentage: 58,
  previousPercentage: 51,
  delta: 7,
  comparisonAt: "2026-08-31T23:59:59.999Z",
  points: [{ at: "2026-09-06T10:00:00.000Z", percentage: 58, applicability: 100, gapAnalysis: 75, actionPlan: 0 }],
  milestones: [],
};
const dashboard = {
  applicability: { outcome: "important_entity", revisionId: "00000000-0000-4000-8000-000000000010", sourceUpdatedAt: "2026-01-10T00:00:00.000Z", stale: false, outdated: false },
  gap: { revisionId: null, findingCount: 0, criticalCount: 0, sourceUpdatedAt: null, stale: false, outdated: false, progress: { answered: 15, total: 20, remaining: 5, percentage: 75, updatedAt: "2026-09-06T10:00:00.000Z" } },
  evidence: { documentCount: 4, currentVersionCount: 3, sourceUpdatedAt: "2026-09-06T10:00:00.000Z", stale: true, outdated: false, counts: { total: 4, active: 3, archived: 1 } },
  plan: { id: null, openItems: 0, totalItems: 0, sourceUpdatedAt: null, stale: false, outdated: false, statuses: { open: 0, inProgress: 0, done: 0, cancelled: 0 }, percentage: 0 },
  report: { id: null, state: null, sourceUpdatedAt: null, stale: false, outdated: false },
  workflow: { steps: [
    { key: "applicability" as const, status: "completed" as const, updatedAt: "2026-01-10T00:00:00.000Z" },
    { key: "gap_analysis" as const, status: "in_progress" as const, updatedAt: "2026-09-06T10:00:00.000Z" },
    { key: "action_plan" as const, status: "locked" as const, updatedAt: null },
  ] },
  recentActivity: activity,
  recentActivityNextCursor: "next",
  complianceProgress: history,
  nextSteps: ["complete_gap_analysis"],
};

describe("dashboard API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.getOrganizationDashboard.mockResolvedValue(dashboard);
    mocks.listDashboardActivity.mockResolvedValue({ items: activity, nextCursor: "next" });
    mocks.getDashboardProgressHistory.mockResolvedValue(history);
  });

  it("returns the complete aggregate dashboard contract", async () => {
    const result = await invokeRouteContract({
      handler: getDashboard,
      context,
      request: new Request(`http://localhost/api/organizations/${organizationId}/dashboard`),
      outputSchema: z.object({ dashboard: (await import("@/src/contracts/dashboard")).dashboardSchema }),
    });
    expect(result.parsed.data.dashboard).toEqual(dashboard);
    expect(mocks.getOrganizationDashboard).toHaveBeenCalledWith(userId, organizationId);
  });

  it("returns a presentation-safe paginated activity page", async () => {
    const result = await invokeRouteContract({
      handler: getActivity,
      context,
      request: new Request(`http://localhost/api/organizations/${organizationId}/dashboard/activity?limit=4`),
      outputSchema: z.object({ activity: z.array(dashboardActivityItemSchema) }),
    });
    expect(result.parsed.data.activity).toEqual(activity);
    expect(result.parsed.meta.nextCursor).toBe("next");
    expect(mocks.listDashboardActivity).toHaveBeenCalledWith({
      userId,
      organizationId,
      limit: 4,
    });
  });

  it("returns validated monthly progress history", async () => {
    const result = await invokeRouteContract({
      handler: getHistory,
      context,
      request: new Request(`http://localhost/api/organizations/${organizationId}/dashboard/progress-history?from=2026-01-01&to=2026-09-06`),
      outputSchema: z.object({ history: dashboardProgressHistorySchema }),
    });
    expect(result.parsed.data.history).toEqual(history);
    expect(mocks.getDashboardProgressHistory).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      organizationId,
      bucket: "month",
    }));
  });

  it("exposes activity and history through the typed dashboard client", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) =>
      Response.json(String(input).includes("activity")
        ? { data: { activity }, meta: { requestId: "activity" } }
        : { data: { history }, meta: { requestId: "history" } }),
    ));
    const [activityResult, historyResult] = await Promise.all([
      dashboardClient.listActivity(organizationId, { limit: 4 }),
      dashboardClient.getProgressHistory(organizationId),
    ]);
    expect(activityResult.data.activity).toEqual(activity);
    expect(historyResult.data.history.currentPercentage).toBe(58);
  });
});
