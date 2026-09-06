import { describe, expect, it } from "vitest";
import { assertActionPlanPublicationLease } from "@/src/server/modules/action-plans/publication-lease-policy";

const now = new Date("2026-08-02T12:00:00.000Z");
const live = {
  state: "running",
  leaseOwner: "worker-new",
  leaseExpiresAt: new Date("2026-08-02T12:01:00.000Z"),
  cancellationRequestedAt: null,
};

describe("Action Plan publication lease", () => {
  it("allows only the exact current owner", () => {
    expect(() => assertActionPlanPublicationLease(live, { workerId: "worker-new", now })).not.toThrow();
    expect(() => assertActionPlanPublicationLease(live, { workerId: "worker-old", now }))
      .toThrow(expect.objectContaining({ code: "ACTION_PLAN_GENERATION_RESERVATION_INVALID" }));
  });

  it.each([
    { state: "succeeded" },
    { leaseExpiresAt: now },
    { cancellationRequestedAt: now },
  ])("rejects a stale publication candidate after provider I/O: %o", (override) => {
    expect(() => assertActionPlanPublicationLease({ ...live, ...override }, { workerId: "worker-new", now }))
      .toThrow(expect.objectContaining({ code: "ACTION_PLAN_GENERATION_RESERVATION_INVALID" }));
  });
});
