import { cookies } from "next/headers";

export const guestApplicabilityCookieName =
  "complyx-guest-applicability-claim";
export const guestApplicabilityTokenHeader = "x-guest-applicability-token";

const maxAgeSeconds = 60 * 60 * 24 * 14;

export function getGuestApplicabilityCookieOptions(secure?: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secure ?? process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function getGuestApplicabilityTokenFromRequest(request: Request) {
  return request.headers.get(guestApplicabilityTokenHeader) ?? undefined;
}

export function shouldUseSecureGuestCookie(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }

  return new URL(request.url).protocol === "https:";
}

export async function getGuestApplicabilityToken() {
  const cookieStore = await cookies();
  return cookieStore.get(guestApplicabilityCookieName)?.value;
}

export async function setGuestApplicabilityToken(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(guestApplicabilityCookieName, token, {
    ...getGuestApplicabilityCookieOptions(),
  });
}

export async function clearGuestApplicabilityToken() {
  const cookieStore = await cookies();
  cookieStore.delete(guestApplicabilityCookieName);
}
