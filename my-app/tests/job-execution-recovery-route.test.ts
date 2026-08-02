import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ drainPortableJobs: vi.fn() }));
vi.mock("@/src/server/job-execution/runtime", () => ({
  drainPortableJobs: mocks.drainPortableJobs,
}));

import {
  GET,
  dynamic,
  maxDuration,
  runtime,
} from "@/app/api/internal/jobs/drain/route";

describe("job recovery route", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "recovery-secret";
    mocks.drainPortableJobs.mockResolvedValue({
      invocationId: "recovery-test",
      adapter: "recovery_route",
      claimed: 0,
      succeeded: 0,
      failed: 0,
      retried: 0,
      cancelled: 0,
      stopReason: "empty_queue",
      durationMs: 1,
    });
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("is an explicit non-cacheable bounded Node function", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
    expect(maxDuration).toBe(300);
  });

  it.each([
    [undefined, undefined],
    ["", "Bearer recovery-secret"],
    ["recovery-secret", undefined],
    ["recovery-secret", "Basic recovery-secret"],
    ["recovery-secret", "Bearer incorrect"],
  ])("fails closed for missing or invalid authorization", async (secret, header) => {
    if (secret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = secret;
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/drain", {
        headers: header ? { authorization: header } : undefined,
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.drainPortableJobs).not.toHaveBeenCalled();
  });

  it("returns only safe drain totals and correlation metadata", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/drain", {
        headers: { authorization: "Bearer recovery-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        drain: {
          adapter: "recovery_route",
          claimed: 0,
          stopReason: "empty_queue",
        },
      },
      meta: { requestId: expect.any(String) },
    });
    expect(mocks.drainPortableJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: "recovery_route",
        maxJobs: 50,
        invocationId: expect.stringMatching(/^recovery-/),
      }),
    );
  });

  it("redacts internal execution errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.drainPortableJobs.mockRejectedValue(
      new Error("provider body and secret must not escape"),
    );
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/drain", {
        headers: { authorization: "Bearer recovery-secret" },
      }),
    );
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("provider body");
  });
});
