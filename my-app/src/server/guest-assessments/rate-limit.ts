import { createHash } from "node:crypto";
import { db } from "@/src/db";
import { guestCreationRateLimits } from "@/src/db/schema";
import { sql } from "drizzle-orm";
import { ApiError } from "../api/errors";

const windowMs = 60 * 60 * 1000;
const maxRequests = 5;

export async function enforceGuestCreationRateLimit(ip: string) {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const windowStartIso = windowStart.toISOString();
  const expiresAtIso = expiresAt.toISOString();
  const identifierHash = createHash("sha256").update(ip).digest("hex");

  const result = await db.execute<{ requestCount: number }>(sql`
    WITH expired AS (
      DELETE FROM ${guestCreationRateLimits}
      WHERE expires_at <= now()
    ),
    incremented AS (
      INSERT INTO ${guestCreationRateLimits} (
        identifier_hash,
        window_start,
        request_count,
        expires_at
      )
      VALUES (
        ${identifierHash},
        ${windowStartIso}::timestamptz,
        1,
        ${expiresAtIso}::timestamptz
      )
      ON CONFLICT (identifier_hash, window_start)
      DO UPDATE SET request_count =
        ${guestCreationRateLimits.requestCount} + 1
      RETURNING request_count AS "requestCount"
    )
    SELECT "requestCount" FROM incremented
  `);

  if ((result[0]?.requestCount ?? maxRequests + 1) > maxRequests) {
    throw new ApiError(429, "Too many guest assessments. Please try again later.");
  }
}

export function requireGuestCaptchaToken(token?: string) {
  const enabled =
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!enabled) return;
  if (!token) throw new ApiError(400, "CAPTCHA verification is required");
}
