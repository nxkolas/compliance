import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/src/client/jobs", () => ({ jobsClient: { get } }));

import { pollJob } from "@/src/client/job-polling";

describe("job polling", () => {
  beforeEach(() => vi.clearAllMocks());
  it("publishes the terminal state and performs a final authoritative refresh", async () => {
    const job = { id: "00000000-0000-4000-8000-000000000001", state: "succeeded" };
    get.mockResolvedValue({ data: { job } });
    const onUpdate = vi.fn();
    const finalRefresh = vi.fn();
    await expect(pollJob({ jobId: job.id, signal: new AbortController().signal, onUpdate, finalRefresh })).resolves.toBe(job);
    expect(onUpdate).toHaveBeenCalledWith(job);
    expect(finalRefresh).toHaveBeenCalledOnce();
  });

  it("honors cancellation before making a request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(pollJob({ jobId: "00000000-0000-4000-8000-000000000001", signal: controller.signal, finalRefresh: vi.fn() })).rejects.toMatchObject({ name: "AbortError" });
    expect(get).not.toHaveBeenCalled();
  });
});
