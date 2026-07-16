import { describe, expect, it } from "vitest";
import {
  guestStartedExpiry,
  guestSubmittedExpiry,
  isGuestCleanupEligible,
} from "@/src/server/applicability-check/guest-lifecycle";

describe("guest applicability lifecycle", () => {
  const startedAt = new Date("2026-07-16T10:00:00.000Z");

  it("expires abandoned starts after 24 hours", () => {
    const expiresAt = guestStartedExpiry(startedAt);
    expect(expiresAt.toISOString()).toBe("2026-07-17T10:00:00.000Z");
    expect(isGuestCleanupEligible({ status: "started", expiresAt }, new Date("2026-07-17T09:59:59.000Z"))).toBe(false);
    expect(isGuestCleanupEligible({ status: "started", expiresAt }, expiresAt)).toBe(true);
  });

  it("expires submitted unclaimed results after 14 days only", () => {
    const claimExpiresAt = guestSubmittedExpiry(startedAt);
    expect(claimExpiresAt.toISOString()).toBe("2026-07-30T10:00:00.000Z");
    expect(isGuestCleanupEligible({ status: "submitted", expiresAt: claimExpiresAt, claimExpiresAt }, claimExpiresAt)).toBe(true);
    expect(isGuestCleanupEligible({ status: "claimed", expiresAt: claimExpiresAt, claimExpiresAt }, claimExpiresAt)).toBe(false);
  });
});
