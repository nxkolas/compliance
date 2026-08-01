import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobDtoSchema } from "@/src/contracts/common/jobs";
import { invokeRouteContract } from "./support/route-contract";
import * as z from "zod";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getAuthorizedJob: vi.fn(),
  enforceOperationRateLimit: vi.fn(),
  scheduleAfterResponseDrain: vi.fn(),
}));

vi.mock("@/src/server/api/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/src/server/api/operation-rate-limit", () => ({ enforceOperationRateLimit: mocks.enforceOperationRateLimit }));
vi.mock("@/src/server/jobs", () => ({
  getAuthorizedJob: mocks.getAuthorizedJob,
  requestJobCancellation: vi.fn(),
}));
vi.mock("@/src/server/job-execution/after-response", () => ({
  scheduleAfterResponseDrain: mocks.scheduleAfterResponseDrain,
}));

import { GET } from "@/app/api/jobs/[jobId]/route";

describe("job status route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001" });
  });

  it("returns only the public job DTO in the common envelope", async () => {
    const job = {
      id: "00000000-0000-4000-8000-000000000002",
      kind: "gap-generation",
      state: "running",
      progress: 40,
      attemptCount: 1,
      safeError: null,
      createdAt: "2026-07-22T12:00:00.000Z",
      updatedAt: "2026-07-22T12:01:00.000Z",
      startedAt: "2026-07-22T12:00:10.000Z",
      finishedAt: null,
      cancellable: true,
      resultLink: null,
    };
    mocks.getAuthorizedJob.mockResolvedValue(job);
    const result = await invokeRouteContract({
      handler: GET,
      context: { params: Promise.resolve({ jobId: job.id }) },
      request: new Request(`http://localhost/api/jobs/${job.id}`, {
        headers: { "x-request-id": "job-status-test" },
      }),
      outputSchema: z.object({ job: jobDtoSchema }),
    });

    expect(result.parsed.data).toEqual({
      job: {
        ...job,
        phase: null,
        completedUnits: null,
        totalUnits: null,
      },
    });
    expect(mocks.getAuthorizedJob).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      job.id,
    );
    expect(mocks.scheduleAfterResponseDrain).toHaveBeenCalledWith({
      adapter: "polling",
      requestId: "job-status-test",
    });
  });

  it("does not wake execution for terminal jobs", async () => {
    mocks.getAuthorizedJob.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
      state: "succeeded",
    });
    const response = await GET(
      new Request(
        "http://localhost/api/jobs/00000000-0000-4000-8000-000000000002",
      ),
      {
        params: Promise.resolve({
          jobId: "00000000-0000-4000-8000-000000000002",
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(mocks.scheduleAfterResponseDrain).not.toHaveBeenCalled();
  });

  it("rejects malformed identifiers before authorization or lookup", async () => {
    const response = await GET(new Request("http://localhost/api/jobs/not-a-uuid"), { params: Promise.resolve({ jobId: "not-a-uuid" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_ROUTE_PARAMETER" } });
    expect(mocks.requireApiUser).not.toHaveBeenCalled();
    expect(mocks.getAuthorizedJob).not.toHaveBeenCalled();
    expect(mocks.scheduleAfterResponseDrain).not.toHaveBeenCalled();
  });
});
