import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  createDocumentSourceAccess: vi.fn(),
}));

vi.mock("@/src/server/api/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/src/server/documents", () => ({
  createDocumentSourceAccess: mocks.createDocumentSourceAccess,
}));

import {
  GET,
  POST,
} from "@/app/api/organizations/[organizationId]/document-versions/[versionId]/source-access/route";

const organizationId = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-8000-000000000002";
const context = {
  params: Promise.resolve({ organizationId, versionId }),
};

describe("document source access route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000003",
    });
    mocks.createDocumentSourceAccess.mockResolvedValue({
      url: "https://storage.example.test/signed#page=8",
      expiresAt: "2026-07-24T12:05:00.000Z",
    });
  });

  it("redirects an inline PDF request without caching it", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/document-versions/${versionId}/source-access?mode=inline&page=8`,
      ),
      context,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://storage.example.test/signed#page=8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createDocumentSourceAccess).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000003",
      organizationId,
      versionId,
      { mode: "inline", page: 8 },
    );
  });

  it("ignores an invalid page number", async () => {
    await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/document-versions/${versionId}/source-access?page=-2`,
      ),
      context,
    );

    expect(mocks.createDocumentSourceAccess).toHaveBeenCalledWith(
      expect.any(String),
      organizationId,
      versionId,
      { mode: "inline", page: undefined },
    );
  });

  it("keeps the existing forced-download POST contract", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/organizations/${organizationId}/document-versions/${versionId}/source-access`,
        { method: "POST" },
      ),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createDocumentSourceAccess).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000003",
      organizationId,
      versionId,
    );
  });

  it("returns the stable safe signing error", async () => {
    const { ApiError } = await import("@/src/server/api/errors");
    mocks.createDocumentSourceAccess.mockRejectedValue(
      new ApiError(
        502,
        "Document source access could not be created",
        undefined,
        "SOURCE_ACCESS_FAILED",
      ),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/document-versions/${versionId}/source-access`,
      ),
      context,
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "SOURCE_ACCESS_FAILED" },
    });
  });
});
