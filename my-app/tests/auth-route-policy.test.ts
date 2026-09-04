import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOOL_DESTINATION,
  isApiRoute,
  isCheckRoute,
  isGuestOnlyAuthRoute,
  isPublicAuthFlowRoute,
  isPublicGuestApiRoute,
  isPublicRoute,
  parseSafeToolNext,
} from "@/src/auth/route-policy";

describe("authentication route policy", () => {
  it.each([
    "/auth/login",
    "/auth/sign-up",
    "/auth/forgot-password",
  ])("classifies %s as an exact guest-only route", (pathname) => {
    expect(isGuestOnlyAuthRoute(pathname)).toBe(true);
    expect(isPublicRoute(pathname)).toBe(true);
  });

  it.each([
    "/auth/callback",
    "/auth/confirm",
    "/auth/error",
    "/auth/update-password",
  ])("classifies %s as an exact public authentication flow route", (pathname) => {
    expect(isPublicAuthFlowRoute(pathname)).toBe(true);
    expect(isPublicRoute(pathname)).toBe(true);
  });

  it.each([
    "/api/guest/applicability-check/submissions",
    "/api/guest/applicability-check/result",
  ])("classifies %s as an exact public guest API", (pathname) => {
    expect(isPublicGuestApiRoute(pathname)).toBe(true);
    expect(isPublicRoute(pathname)).toBe(true);
  });

  it("keeps the guest claim API private", () => {
    expect(
      isPublicGuestApiRoute("/api/guest/applicability-check/claim"),
    ).toBe(false);
    expect(isPublicRoute("/api/guest/applicability-check/claim")).toBe(false);
  });

  it("uses segment boundaries for auth, check, and API routes", () => {
    expect(isGuestOnlyAuthRoute("/auth/login/extra")).toBe(false);
    expect(isPublicAuthFlowRoute("/auth/callback/extra")).toBe(false);
    expect(isPublicRoute("/authentication")).toBe(false);

    expect(isCheckRoute("/check")).toBe(true);
    expect(isCheckRoute("/check/applicability")).toBe(true);
    expect(isCheckRoute("/checklist")).toBe(false);
    expect(isPublicRoute("/checklist")).toBe(false);

    expect(isApiRoute("/api")).toBe(true);
    expect(isApiRoute("/api/organizations")).toBe(true);
    expect(isApiRoute("/apix")).toBe(false);
    expect(isPublicRoute("/apix")).toBe(false);
  });

  it("keeps unknown routes private by default", () => {
    expect(isPublicRoute("/auth")).toBe(false);
    expect(isPublicRoute("/tool")).toBe(false);
    expect(isPublicRoute("/unknown")).toBe(false);
  });
});

describe("safe tool next destinations", () => {
  it.each([
    ["/tool", "/tool"],
    ["/tool/", "/tool/"],
    [
      "/tool/organizations/org-1?tab=members",
      "/tool/organizations/org-1?tab=members",
    ],
  ])("accepts %s", (value, expected) => {
    expect(parseSafeToolNext(value)).toBe(expected);
  });

  it.each([
    null,
    "",
    "tool/organizations",
    "//example.com/tool",
    "https://example.com/tool",
    "/api/organizations",
    "/auth/login",
    "/auth/login?next=/tool",
    "/check/applicability",
    "/toolbox",
    "/tool/../auth/login",
    "/tool/%2e%2e/auth/login",
    String.raw`\tool\organizations`,
  ])("falls back for unsafe destination %s", (value) => {
    expect(parseSafeToolNext(value)).toBe(DEFAULT_TOOL_DESTINATION);
  });
});
