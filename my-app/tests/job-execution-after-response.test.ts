import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ drainPortableJobs: vi.fn() }));

vi.mock("@/src/server/job-execution/runtime", () => ({
  drainPortableJobs: mocks.drainPortableJobs,
}));

import { scheduleAfterResponseDrain } from "@/src/server/job-execution/after-response";

describe("after-response job execution adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drainPortableJobs.mockResolvedValue({ stopReason: "empty_queue" });
  });

  it("registers exactly one callback without awaiting job completion", async () => {
    let callback: (() => Promise<void>) | undefined;
    const schedule = vi.fn((value: () => void | Promise<void>) => {
      callback = async () => void (await value());
    });

    expect(
      scheduleAfterResponseDrain({
        requestId: "request-1",
        schedule,
      }),
    ).toBe(true);
    expect(schedule).toHaveBeenCalledOnce();
    expect(mocks.drainPortableJobs).not.toHaveBeenCalled();

    await callback!();
    expect(mocks.drainPortableJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: "after_response",
        maxJobs: 25,
        invocationId: expect.stringMatching(/^after_response-/),
      }),
    );
  });

  it("keeps scheduler failures out of the committed response path", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(
      scheduleAfterResponseDrain({
        requestId: "request-2",
        schedule: () => {
          throw new Error("no request work store");
        },
      }),
    ).toBe(false);
    expect(error).toHaveBeenCalledWith(
      "Could not schedule after-response job drain",
      expect.objectContaining({ adapter: "after_response", errorType: "Error" }),
    );
    error.mockRestore();
  });
});
