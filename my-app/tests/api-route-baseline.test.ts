import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  listOrganizationsForUserPage: vi.fn(),
  createOrganizationForUser: vi.fn(),
  getOrganizationForUser: vi.fn(),
  idempotencyCreate: vi.fn(),
  idempotencyFind: vi.fn(),
  idempotencySave: vi.fn(),
}));

vi.mock("@/src/server/api/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/src/server/organizations/service", () => ({
  listOrganizationsForUserPage: mocks.listOrganizationsForUserPage,
  createOrganizationForUser: mocks.createOrganizationForUser,
  getOrganizationForUser: mocks.getOrganizationForUser,
}));

vi.mock("@/src/server/idempotency", () => ({
  databaseIdempotencyRepository: {
    create: mocks.idempotencyCreate,
    find: mocks.idempotencyFind,
    save: mocks.idempotencySave,
  },
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: vi.fn() };
});

import { GET, POST } from "@/app/api/organizations/route";

describe("existing organization route baseline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.idempotencyCreate.mockResolvedValue(true);
    mocks.idempotencySave.mockResolvedValue(undefined);
  });

  it("returns the migrated organization list envelope", async () => {
    mocks.listOrganizationsForUserPage.mockResolvedValue({ organizations: [{ id: "organization-1" }] });

    const response = await GET(new Request("http://localhost/api/organizations"), undefined);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { organizations: [{ id: "organization-1" }] },
      meta: { requestId: expect.any(String) },
    });
  });

  it("keeps the create status inside the common envelope", async () => {
    mocks.createOrganizationForUser.mockResolvedValue({ id: "organization-2", version: 1 });

    const response = await POST(
      new Request("http://localhost/api/organizations", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "organization-create-1" },
        body: JSON.stringify({ name: "Example GmbH", country: "de" }),
      }), undefined,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: { organization: { id: "organization-2", version: 1 }, reused: false },
      meta: { requestId: expect.any(String), version: 1 },
    });
    expect(mocks.createOrganizationForUser).toHaveBeenCalledWith("user-1", {
      name: "Example GmbH",
      country: "DE",
    });
  });

  it("keeps the current safe authentication error response", async () => {
    const { ApiError } = await import("@/src/server/api/errors");
    mocks.requireApiUser.mockRejectedValue(
      new ApiError(401, "Authentication required"),
    );

    const response = await GET(new Request("http://localhost/api/organizations"), undefined);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required",
      requestId: expect.any(String),
    } });
  });
});
