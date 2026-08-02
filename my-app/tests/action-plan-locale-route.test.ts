import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  enqueue: vi.fn(),
  getAuthorizedJob: vi.fn(),
  revalidatePath: vi.fn(),
  enforceOperationRateLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/src/server/api/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("@/src/server/api/operation-rate-limit", () => ({
  enforceOperationRateLimit: mocks.enforceOperationRateLimit,
}));
vi.mock("@/src/server/api/idempotency", () => ({
  runIdempotentCommand: vi.fn(async (input) => ({
    value: await input.execute(),
    reused: false,
  })),
}));
vi.mock("@/src/server/action-plans", () => ({
  enqueueActionPlanGeneration: mocks.enqueue,
  getCurrentActionPlan: vi.fn(),
}));
vi.mock("@/src/server/jobs", () => ({
  getAuthorizedJob: mocks.getAuthorizedJob,
  toJobDto: (job: unknown) => job,
}));
vi.mock("@/src/server/idempotency", () => ({
  databaseIdempotencyRepository: {},
}));

import { POST } from "@/app/api/organizations/[organizationId]/action-plan/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const revisionId = "00000000-0000-4000-8000-000000000003";
const jobId = "00000000-0000-4000-8000-000000000004";

describe("asynchronous action-plan generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.enqueue.mockResolvedValue({
      id: jobId,
      kind: "action-plan-generation",
      state: "queued",
      progress: 0,
      attemptCount: 0,
      safeError: null,
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z",
      startedAt: null,
      finishedAt: null,
      cancellable: true,
      resultLink: null,
      result: null,
    });
  });

  it("pins locale from the source revision and returns the generation job", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/organizations/${organizationId}/action-plan`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": "action-plan-1",
          },
          body: JSON.stringify({ gapRevisionId: revisionId }),
        },
      ),
      { params: Promise.resolve({ organizationId }) },
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      data: { job: { id: jobId }, reused: false },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({
      userId,
      organizationId,
      sourceGapRevisionId: revisionId,
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.not.objectContaining({ locale: expect.anything() }),
    );
    expect(mocks.enforceOperationRateLimit).toHaveBeenCalledWith({
      userId,
      operation: "plans:generate",
      scopeId: organizationId,
    });
  });
});
