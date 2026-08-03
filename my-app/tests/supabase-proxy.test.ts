import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  cookiesToSet: [
    {
      name: "sb-session",
      value: "refreshed-session",
      options: { httpOnly: true, path: "/" },
    },
  ] as Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }>,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { config as proxyConfig } from "@/proxy";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function request(path: string, headers?: HeadersInit) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

function authenticatedUser() {
  return { id: "user-1", is_anonymous: false };
}

function anonymousUser() {
  return { id: "anonymous-1", is_anonymous: true };
}

describe("Supabase authentication proxy", () => {
  it("keeps health probes outside the authentication proxy", () => {
    const matcher = new RegExp(`^${proxyConfig.matcher[0]}$`);

    expect(matcher.test("/api/health/live")).toBe(false);
    expect(matcher.test("/api/health/ready")).toBe(false);
    expect(matcher.test("/api/organizations")).toBe(true);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    mocks.cookiesToSet = [
      {
        name: "sb-session",
        value: "refreshed-session",
        options: { httpOnly: true, path: "/" },
      },
    ];
    mocks.createServerClient.mockImplementation(
      (_url, _key, options) => {
        options.cookies.setAll(mocks.cookiesToSet);
        return { auth: { getUser: mocks.getUser } };
      },
    );
    mocks.getUser.mockResolvedValue({
      data: { user: authenticatedUser() },
      error: null,
    });
  });

  afterAll(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalSupabaseKey;
    }
  });

  it("redirects an unauthenticated private page with its safe path and query", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await updateSession(
      request("/tool/organizations/org-1?tab=members"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/login?next=%2Ftool%2Forganizations%2Forg-1%3Ftab%3Dmembers",
    );
  });

  it("delegates private API authentication to the route without resolving a user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await updateSession(
      request("/api/organizations", { "x-request-id": "proxy-request-1" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("treats anonymous sessions as unauthenticated for private pages", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: anonymousUser() },
      error: null,
    });

    const pageResponse = await updateSession(request("/tool/organizations"));
    expect(pageResponse.status).toBe(307);
    expect(pageResponse.headers.get("location")).toContain("/auth/login?");
  });

  it("allows anonymous sessions to open guest-only authentication pages", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: anonymousUser() },
      error: null,
    });

    const response = await updateSession(request("/auth/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves API configuration errors to the authoritative route", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const response = await updateSession(
      request("/api/organizations", { "x-request-id": "proxy-request-503" }),
    );

    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    "/auth/login",
    "/auth/sign-up",
    "/auth/forgot-password",
  ])("redirects a full user away from %s", async (pathname) => {
    const response = await updateSession(request(pathname));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/tool/organizations",
    );
  });

  it("honors a safe tool next value for a full user", async () => {
    const response = await updateSession(
      request(
        "/auth/login?next=%2Ftool%2Forganizations%2Forg-1%3Ftab%3Dmembers",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/tool/organizations/org-1?tab=members",
    );
  });

  it.each([
    "https%3A%2F%2Fexample.com",
    "%2F%2Fevil.example",
    "%2Fapi%2Forganizations",
    "%2Fauth%2Flogin",
  ])("falls back for unsafe next value %s", async (next) => {
    const response = await updateSession(request(`/auth/login?next=${next}`));

    expect(response.headers.get("location")).toBe(
      "http://localhost/tool/organizations",
    );
  });

  it.each([
    "/auth/callback",
    "/auth/confirm",
    "/auth/error",
    "/auth/update-password",
  ])("continues the public authentication flow at %s", async (pathname) => {
    const response = await updateSession(request(pathname));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves the password-recovery callback destination unrestricted", async () => {
    const response = await updateSession(
      request("/auth/callback?next=%2Fauth%2Fupdate-password"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    {
      id: "platform-admin-1",
      is_anonymous: false,
      app_metadata: { platform_administrator: true },
    },
    {
      id: "organization-admin-1",
      is_anonymous: false,
      app_metadata: {},
    },
  ])("allows the full $id session through private pages and APIs", async (user) => {
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });

    const pageResponse = await updateSession(request("/tool/organizations"));
    const apiResponse = await updateSession(request("/api/organizations"));

    expect(pageResponse.status).toBe(200);
    expect(pageResponse.headers.get("x-middleware-next")).toBe("1");
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    "/api/guest/applicability-check/submissions",
    "/api/guest/applicability-check/result",
  ])("continues the public guest API at %s", async (pathname) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await updateSession(request(pathname));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("delegates the private guest claim API to its authenticated route", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await updateSession(
      request("/api/guest/applicability-check/claim"),
    );

    expect(response.status).toBe(200);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("preserves refreshed cookies on page redirects", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const redirect = await updateSession(request("/tool/organizations"));
    expect(redirect.headers.get("set-cookie")).toContain(
      "sb-session=refreshed-session",
    );
  });

  it("preserves cleared cookies on page redirects", async () => {
    mocks.cookiesToSet = [
      {
        name: "sb-session",
        value: "",
        options: { maxAge: 0, path: "/" },
      },
    ];
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const redirect = await updateSession(request("/tool/organizations"));
    expect(redirect.headers.get("set-cookie")).toContain(
      "sb-session=; Path=/; Max-Age=0",
    );
  });
});
