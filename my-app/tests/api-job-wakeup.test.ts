import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ scheduleAfterResponseDrain: vi.fn() }));
vi.mock("@/src/server/platform/jobs/execution/after-response", () => ({
  scheduleAfterResponseDrain: mocks.scheduleAfterResponseDrain,
}));

import { apiRoute } from "@/src/server/platform/http/handler";

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

  // A route that enqueues work but does not answer 202 gets no automatic
  // wake-up, so it has to schedule its own drain. Missing this is why the
  // re-embedding job stayed queued indefinitely.
  it("requires every enqueueing route to answer 202 or schedule its own drain", async () => {
    const enqueueingRoutes = [
      "app/api/organizations/[organizationId]/settings/route.ts",
      "app/api/organizations/[organizationId]/route.ts",
      "app/api/organizations/[organizationId]/document-upload-sessions/[sessionId]/complete/route.ts",
    ];
    const { readFileSync } = await import("node:fs");

    for (const route of enqueueingRoutes) {
      const source = readFileSync(route, "utf8");
      expect(
        source.includes("scheduleAfterResponseDrain({ requestId })"),
        `${route} enqueues work without answering 202, so it must schedule a drain`,
      ).toBe(true);
    }
  });
});
