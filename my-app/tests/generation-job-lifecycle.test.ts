import { describe, expect, it } from "vitest";
import { assertLiveParentForAiRun } from "@/src/server/ai/generation/job-run-policy";

const now = new Date("2026-07-29T12:00:00.000Z");
const organizationId = "00000000-0000-4000-8000-000000000001";
const liveParent = {
  organizationId,
  state: "running",
  cancellationRequestedAt: null,
  leaseOwner: "worker-1",
  leaseExpiresAt: new Date("2026-07-29T12:01:00.000Z"),
};

describe("job-linked AI run lifecycle", () => {
  it("permits a live leased parent in the same organization", () => {
    expect(() =>
      assertLiveParentForAiRun(liveParent, { now, organizationId }),
    ).not.toThrow();
  });

  it.each([
    ["queued", null, "GENERATION_PARENT_JOB_NOT_RUNNING"],
    ["failed", null, "PARENT_JOB_TERMINATED"],
    ["succeeded", null, "PARENT_JOB_TERMINATED"],
    ["cancelled", null, "GENERATION_CANCELLED"],
    ["running", now, "GENERATION_CANCELLED"],
  ])(
    "rejects parent state %s with the deliberate safe code",
    (state, cancellationRequestedAt, safeCode) => {
      expect(() =>
        assertLiveParentForAiRun(
          { ...liveParent, state, cancellationRequestedAt },
          { now, organizationId },
        ),
      ).toThrow(expect.objectContaining({ safeCode }));
    },
  );

  it.each([null, new Date("2026-07-29T11:59:59.000Z")])(
    "treats a missing or expired lease as transient ownership loss",
    (leaseExpiresAt) => {
      expect(() =>
        assertLiveParentForAiRun(
          { ...liveParent, leaseExpiresAt },
          { now, organizationId },
        ),
      ).toThrow(
        expect.objectContaining({
          failureClass: "transient_provider",
          safeCode: "GENERATION_JOB_LEASE_LOST",
        }),
      );
    },
  );

  it("rejects a cross-organization child", () => {
    expect(() =>
      assertLiveParentForAiRun(liveParent, {
        now,
        organizationId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toThrow(
      expect.objectContaining({
        safeCode: "GENERATION_PARENT_JOB_SCOPE_MISMATCH",
      }),
    );
  });
});
