import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ scheduleAfterResponseDrain: vi.fn() }));
vi.mock("@/src/server/job-execution/after-response", () => ({
  scheduleAfterResponseDrain: mocks.scheduleAfterResponseDrain,
}));

import { apiRoute } from "@/src/server/api/handler";

describe("asynchronous API job wake-up", () => {
  beforeEach(() => vi.clearAllMocks());

  it("schedules exactly one drain for a successful 202 response", async () => {
    const route = apiRoute(async () => ({
      status: 202,
      data: { job: { id: "job-1" }, reused: true },
    }));
    const response = await route(
      new Request("http://localhost/api/example", {
        method: "POST",
        headers: { "x-request-id": "wake-request-1" },
      }),
      undefined,
    );

    expect(response.status).toBe(202);
    expect(mocks.scheduleAfterResponseDrain).toHaveBeenCalledOnce();
    expect(mocks.scheduleAfterResponseDrain).toHaveBeenCalledWith({
      requestId: "wake-request-1",
    });
  });

  it.each([200, 201, 204, 400, 500])(
    "does not schedule a drain for status %s",
    async (status) => {
      const route = apiRoute(async () =>
        status === 204
          ? { status, data: undefined }
          : { status, data: { status } },
      );
      const response = await route(
        new Request("http://localhost/api/example"),
        undefined,
      );
      expect(response.status).toBe(status);
      expect(mocks.scheduleAfterResponseDrain).not.toHaveBeenCalled();
    },
  );
});
