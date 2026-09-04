export const GUEST_STARTED_TTL_HOURS = 24;
export const GUEST_SUBMITTED_TTL_DAYS = 14;

export function guestStartedExpiry(from: Date) {
  const expiresAt = new Date(from);
  expiresAt.setHours(expiresAt.getHours() + GUEST_STARTED_TTL_HOURS);
  return expiresAt;
}

export function guestSubmittedExpiry(from: Date) {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + GUEST_SUBMITTED_TTL_DAYS);
  return expiresAt;
}

export function isGuestCleanupEligible(
  session: { status: "started" | "submitted" | "claimed" | "expired" | "deleted"; expiresAt: Date; claimExpiresAt?: Date | null },
  now: Date,
) {
  if (session.status === "started") return session.expiresAt <= now;
  if (session.status === "submitted") return (session.claimExpiresAt ?? session.expiresAt) <= now;
  return false;
}
