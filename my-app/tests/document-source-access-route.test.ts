import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  createDocumentSourceAccess: vi.fn(),
}));

vi.mock("@/src/server/platform/http/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/src/server/modules/documents", () => ({
  createDocumentSourceAccess: mocks.createDocumentSourceAccess,
}));

import { GET as getInlineSource } from "@/app/api/organizations/[organizationId]/documents/[documentId]/source-access/route";
import { GET as downloadDocument } from "@/app/api/organizations/[organizationId]/documents/[documentId]/download/route";

const organizationId = "00000000-0000-4000-8000-000000000001";
const documentId = "00000000-0000-4000-8000-000000000002";
const context = {
  params: Promise.resolve({ organizationId, documentId }),
};

describe("document source access routes", () => {
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
    const response = await getInlineSource(
      new Request(
        `http://localhost/api/organizations/${organizationId}/documents/${documentId}/source-access?page=8`,
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
      documentId,
      { mode: "inline", page: 8 },
    );
  });

  it("ignores an invalid page number", async () => {
    await getInlineSource(
      new Request(
        `http://localhost/api/organizations/${organizationId}/documents/${documentId}/source-access?page=-2`,
      ),
      context,
    );

    expect(mocks.createDocumentSourceAccess).toHaveBeenCalledWith(
      expect.any(String),
      organizationId,
      documentId,
      { mode: "inline", page: undefined },
    );
  });

  it("redirects downloads without caching them", async () => {
    const response = await downloadDocument(
      new Request(
        `http://localhost/api/organizations/${organizationId}/documents/${documentId}/download`,
      ),
      context,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createDocumentSourceAccess).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000003",
      organizationId,
      documentId,
      { mode: "download" },
    );
  });

  it("returns the stable safe signing error", async () => {
    const { ApiError } = await import("@/src/server/platform/http/errors");
    mocks.createDocumentSourceAccess.mockRejectedValue(
      new ApiError(
        502,
        "Document source access could not be created",
        undefined,
        "SOURCE_ACCESS_FAILED",
      ),
    );

    const response = await getInlineSource(
      new Request(
        `http://localhost/api/organizations/${organizationId}/documents/${documentId}/source-access`,
      ),
      context,
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "SOURCE_ACCESS_FAILED" },
    });
  });
});
