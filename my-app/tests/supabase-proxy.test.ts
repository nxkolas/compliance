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

  it("returns a standard JSON 401 for an unauthenticated private API", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await updateSession(
      request("/api/organizations", { "x-request-id": "proxy-request-1" }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-request-id")).toBe("proxy-request-1");
    expect(await response.json()).toEqual({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        requestId: "proxy-request-1",
      },
    });
  });

  it("replaces an invalid request ID and keeps the generated value in the body and header", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await updateSession(
      request("/api/organizations", { "x-request-id": "invalid request id" }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  });

  it("treats anonymous sessions as unauthenticated for private pages and APIs", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: anonymousUser() },
      error: null,
    });

    const pageResponse = await updateSession(request("/tool/organizations"));
    const apiResponse = await updateSession(request("/api/organizations"));

    expect(pageResponse.status).toBe(307);
    expect(pageResponse.headers.get("location")).toContain("/auth/login?");
    expect(apiResponse.status).toBe(401);
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

  it("returns a standard JSON 503 for private APIs when configuration is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const response = await updateSession(
      request("/api/organizations", { "x-request-id": "proxy-request-503" }),
    );

    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBe("proxy-request-503");
    expect(await response.json()).toEqual({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Authentication service unavailable",
        requestId: "proxy-request-503",
      },
    });
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

  it("keeps the guest claim API private", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await updateSession(
      request("/api/guest/applicability-check/claim"),
    );

    expect(response.status).toBe(401);
  });

  it("preserves refreshed cookies on redirects and JSON errors", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const redirect = await updateSession(request("/tool/organizations"));
    const error = await updateSession(request("/api/organizations"));

    expect(redirect.headers.get("set-cookie")).toContain(
      "sb-session=refreshed-session",
    );
    expect(error.headers.get("set-cookie")).toContain(
      "sb-session=refreshed-session",
    );
  });

  it("preserves cleared cookies on redirects and JSON errors", async () => {
    mocks.cookiesToSet = [
      {
        name: "sb-session",
        value: "",
        options: { maxAge: 0, path: "/" },
      },
    ];
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const redirect = await updateSession(request("/tool/organizations"));
    const error = await updateSession(request("/api/organizations"));

    expect(redirect.headers.get("set-cookie")).toContain(
      "sb-session=; Path=/; Max-Age=0",
    );
    expect(error.headers.get("set-cookie")).toContain(
      "sb-session=; Path=/; Max-Age=0",
    );
  });
});
