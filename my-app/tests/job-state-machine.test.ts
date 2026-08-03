import { describe, expect, it } from "vitest";
import { canLeaseJob, cancellationTransition, nextFailureState } from "@/src/server/jobs/state-machine";
import { jobDtoSchema } from "@/src/contracts/common/jobs";

describe("durable job state machine", () => {
  const now = new Date("2026-07-22T12:00:00Z");

  it("parses legacy job DTOs without progress detail", () => {
    const parsed = jobDtoSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      kind: "legacy",
      state: "running",
      progress: 25,
      attemptCount: 1,
      safeError: null,
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:01.000Z",
      startedAt: "2026-08-01T12:00:01.000Z",
      finishedAt: null,
      cancellable: true,
      resultLink: null,
    });
    expect(parsed).toMatchObject({
      phase: null,
      completedUnits: null,
      totalUnits: null,
    });
  });

  it("leases due queued work and recovers expired leases", () => {
    expect(canLeaseJob({ state: "queued", runAfter: now, leaseExpiresAt: null }, now)).toBe(true);
    expect(canLeaseJob({ state: "running", runAfter: now, leaseExpiresAt: new Date(now.getTime() - 1) }, now)).toBe(true);
    expect(canLeaseJob({ state: "cancellation_requested", runAfter: now, leaseExpiresAt: new Date(now.getTime() - 1) }, now)).toBe(true);
    expect(canLeaseJob({ state: "running", runAfter: now, leaseExpiresAt: new Date(now.getTime() + 1) }, now)).toBe(false);
  });

  it("retries only while attempts remain", () => {
    expect(nextFailureState(1, 3)).toBe("queued");
    expect(nextFailureState(3, 3)).toBe("failed");
  });

  it("cancels queued work immediately and asks a running worker to stop", () => {
    expect(cancellationTransition("queued", true)).toBe("cancelled");
    expect(cancellationTransition("running", true)).toBe("cancellation_requested");
    expect(() => cancellationTransition("succeeded", true)).toThrowError(expect.objectContaining({ code: "JOB_NOT_CANCELLABLE" }));
  });
});
