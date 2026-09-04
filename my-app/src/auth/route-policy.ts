export const DEFAULT_TOOL_DESTINATION = "/tool/organizations";

export const GUEST_ONLY_AUTH_ROUTES = [
  "/auth/login",
  "/auth/sign-up",
  "/auth/forgot-password",
] as const;

export const PUBLIC_AUTH_FLOW_ROUTES = [
  "/auth/callback",
  "/auth/confirm",
  "/auth/error",
  "/auth/update-password",
] as const;

export const PUBLIC_GUEST_API_ROUTES = [
  "/api/guest/applicability-check/submissions",
  "/api/guest/applicability-check/result",
] as const;

const guestOnlyAuthRoutes = new Set<string>(GUEST_ONLY_AUTH_ROUTES);
const publicAuthFlowRoutes = new Set<string>(PUBLIC_AUTH_FLOW_ROUTES);
const publicGuestApiRoutes = new Set<string>(PUBLIC_GUEST_API_ROUTES);

function hasPathSegmentPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isApiRoute(pathname: string) {
  return hasPathSegmentPrefix(pathname, "/api");
}

export function isCheckRoute(pathname: string) {
  return hasPathSegmentPrefix(pathname, "/check");
}

export function isGuestOnlyAuthRoute(pathname: string) {
  return guestOnlyAuthRoutes.has(pathname);
}

export function isPublicAuthFlowRoute(pathname: string) {
  return publicAuthFlowRoutes.has(pathname);
}

export function isPublicGuestApiRoute(pathname: string) {
  return publicGuestApiRoutes.has(pathname);
}

export function isPublicRoute(pathname: string) {
  if (isApiRoute(pathname)) {
    return isPublicGuestApiRoute(pathname);
  }

  return (
    pathname === "/" ||
    isCheckRoute(pathname) ||
    isGuestOnlyAuthRoute(pathname) ||
    isPublicAuthFlowRoute(pathname)
  );
}

export function parseSafeToolNext(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_TOOL_DESTINATION;
  }

  try {
    const url = new URL(value, "http://local");
    if (
      url.origin !== "http://local" ||
      !hasPathSegmentPrefix(url.pathname, "/tool")
    ) {
      return DEFAULT_TOOL_DESTINATION;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_TOOL_DESTINATION;
  }
}
