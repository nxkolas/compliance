import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { requireApiUser } from "@/src/server/platform/http/auth";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe("requireApiUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
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

  it("returns an authenticated non-anonymous user", async () => {
    const user = {
      id: "user-1",
      email: " User@Example.com ",
      is_anonymous: false,
      user_metadata: { full_name: " User Name " },
    };
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });

    await expect(requireApiUser()).resolves.toEqual({
      id: "user-1",
      email: "user@example.com",
      displayName: "User Name",
    });
  });

  it.each([
    [{ data: { user: null }, error: null }],
    [{ data: { user: null }, error: new Error("invalid session") }],
    [
      {
        data: { user: { id: "anonymous-1", is_anonymous: true } },
        error: null,
      },
    ],
  ])("rejects a missing, invalid, or anonymous session", async (result) => {
    mocks.getUser.mockResolvedValue(result);

    await expect(requireApiUser()).rejects.toMatchObject({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required",
    });
  });

  it("returns 503 before constructing a client when configuration is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    await expect(requireApiUser()).rejects.toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Authentication service unavailable",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
