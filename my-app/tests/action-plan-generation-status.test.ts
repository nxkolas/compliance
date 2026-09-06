import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("@/src/server/platform/auth/organization-scope", () => ({ authorizeOrganizationRead: mocks.authorize }));
import { getActionPlanGenerationStatus } from "@/src/server/modules/action-plans/generation-status";

describe("action plan generation status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks membership and selects active work or the latest job for the current revision", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "job-1", state: "running" }]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const select = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
    mocks.authorize.mockResolvedValue({ executor: { select } });

    expect(await getActionPlanGenerationStatus("user-1", "org-1", "revision-1"))
      .toEqual({ id: "job-1", state: "running" });
    expect(mocks.authorize).toHaveBeenCalledWith({ actorUserId: "user-1", organizationId: "org-1", capability: "plans:read" });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain('"background_jobs"."organization_id"');
    expect(query.sql).toContain("sourceGapRevisionId");
    expect(query.params).toEqual(["org-1", "action_plan_generation", "revision-1"]);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("does not query jobs until a Gap revision exists", async () => {
    const select = vi.fn();
    mocks.authorize.mockResolvedValue({ executor: { select } });
    expect(await getActionPlanGenerationStatus("user-1", "org-1", null)).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("does not read job data without organization access", async () => {
    mocks.authorize.mockRejectedValue(new Error("forbidden"));
    await expect(getActionPlanGenerationStatus("user-1", "other-org", "revision-1")).rejects.toThrow("forbidden");
  });
});
