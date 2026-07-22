import { describe, expect, it } from "vitest";
import { canLeaseJob, cancellationTransition, nextFailureState } from "@/src/server/jobs/state-machine";

describe("durable job state machine", () => {
  const now = new Date("2026-07-22T12:00:00Z");

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
