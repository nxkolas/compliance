import { ApiError } from "../api/errors";

const windowMs = 60 * 60 * 1000;
const maxRequests = 5;
const requests = new Map<string, number[]>();

export function enforceGuestCreationRateLimit(ip: string) {
  const now = Date.now();
  const recent = (requests.get(ip) ?? []).filter(
    (timestamp) => timestamp > now - windowMs,
  );
  if (recent.length >= maxRequests) {
    throw new ApiError(429, "Too many guest assessments. Please try again later.");
  }
  recent.push(now);
  requests.set(ip, recent);
}

export function requireGuestCaptchaToken(token?: string) {
  const enabled =
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!enabled) return;
  if (!token) throw new ApiError(400, "CAPTCHA verification is required");
}
