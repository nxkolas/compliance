import { describe, expect, it, vi } from "vitest";
import { createJobDrain } from "@/src/server/job-execution/drain";
import type { JobExecutionCycleResult } from "@/src/server/job-execution/contracts";

function harness(cycles: JobExecutionCycleResult[]) {
  let now = 1_000;
  const ensureSchedules = vi.fn(async () => undefined);
  const runOneCycle = vi.fn(
    async (): Promise<JobExecutionCycleResult> =>
      cycles.shift() ?? { claimed: false },
  );
  return {
    ensureSchedules,
    runOneCycle,
    setNow(value: number) {
      now = value;
    },
    drain: createJobDrain({ now: () => now, ensureSchedules, runOneCycle }),
  };
}

const input = () => ({
  invocationId: "test-drain-1",
  adapter: "recovery_route" as const,
  maxJobs: 10,
  deadline: new Date(10_000),
  deadlineMarginMs: 0,
});

describe("portable job drain", () => {
  it("validates limits and expired deadlines before touching schedules", async () => {
    const test = harness([]);
    await expect(test.drain({ ...input(), maxJobs: 0 })).rejects.toThrow(
      "maxJobs",
    );
    await expect(
      test.drain({ ...input(), deadline: new Date(1_000) }),
    ).rejects.toThrow("deadline");
    expect(test.ensureSchedules).not.toHaveBeenCalled();
    expect(test.runOneCycle).not.toHaveBeenCalled();
  });

  it("accounts for every terminal and retry outcome until the queue is empty", async () => {
    const test = harness([
      { claimed: true, outcome: "succeeded" },
      { claimed: true, outcome: "retried" },
      { claimed: true, outcome: "failed" },
      { claimed: true, outcome: "cancelled" },
      { claimed: false },
    ]);

    await expect(test.drain(input())).resolves.toMatchObject({
      claimed: 4,
      succeeded: 1,
      retried: 1,
      failed: 1,
      cancelled: 1,
      stopReason: "empty_queue",
    });
    expect(test.ensureSchedules).toHaveBeenCalledOnce();
    expect(test.runOneCycle).toHaveBeenCalledTimes(5);
  });

  it("does not lease another job after reaching the maximum", async () => {
    const test = harness([
      { claimed: true, outcome: "succeeded" },
      { claimed: true, outcome: "succeeded" },
      { claimed: true, outcome: "succeeded" },
    ]);

    await expect(test.drain({ ...input(), maxJobs: 2 })).resolves.toMatchObject({
      claimed: 2,
      succeeded: 2,
      stopReason: "max_jobs",
    });
    expect(test.runOneCycle).toHaveBeenCalledTimes(2);
  });

  it("stops before another lease when the deadline margin is reached", async () => {
    const test = harness([{ claimed: true, outcome: "succeeded" }]);
    test.runOneCycle.mockImplementationOnce(async () => {
      test.setNow(9_500);
      return { claimed: true, outcome: "succeeded" };
    });

    await expect(
      test.drain({ ...input(), deadlineMarginMs: 500 }),
    ).resolves.toMatchObject({ claimed: 1, stopReason: "deadline" });
    expect(test.runOneCycle).toHaveBeenCalledOnce();
  });

  it("honors an already-aborted caller without touching the database", async () => {
    const test = harness([]);
    const controller = new AbortController();
    controller.abort("shutdown");

    await expect(
      test.drain({
        ...input(),
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({
      claimed: 0,
      stopReason: "caller_abort",
    });
    expect(test.ensureSchedules).not.toHaveBeenCalled();
  });
});
