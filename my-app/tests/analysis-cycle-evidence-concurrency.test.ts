import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  revalidatePath: vi.fn(),
  replaceGapAnalysisEvidence: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/src/server/api/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/src/server/gap-analysis", () => ({
  replaceGapAnalysisEvidence: mocks.replaceGapAnalysisEvidence,
}));

import { PUT } from "@/app/api/organizations/[organizationId]/gap-analysis/cycles/[cycleId]/evidence/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const draftId = "00000000-0000-4000-8000-000000000003";
const documentId = "00000000-0000-4000-8000-000000000004";

function request(ifMatch?: number) {
  const headers = new Headers({ "content-type": "application/json" });
  if (ifMatch !== undefined) headers.set("if-match", String(ifMatch));
  return new Request(`http://localhost/api/organizations/${organizationId}/gap-analysis/cycles/${draftId}/evidence`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      expectedLockVersion: 2,
      selectedDocumentIds: [documentId],
    }),
  });
}

describe("analysis cycle evidence optimistic concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.replaceGapAnalysisEvidence.mockResolvedValue({
      id: draftId,
      lockVersion: 3,
    });
  });

  it("requires If-Match", async () => {
    const response = await PUT(request(), {
      params: Promise.resolve({ organizationId, cycleId: draftId }),
    });

    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "IF_MATCH_REQUIRED" },
    });
    expect(mocks.replaceGapAnalysisEvidence).not.toHaveBeenCalled();
  });

  it("rejects a body version that disagrees with If-Match", async () => {
    const response = await PUT(request(1), {
      params: Promise.resolve({ organizationId, cycleId: draftId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PRECONDITION_MISMATCH" },
    });
    expect(mocks.replaceGapAnalysisEvidence).not.toHaveBeenCalled();
  });

  it("passes the matching expected version and returns the new version", async () => {
    const response = await PUT(request(2), {
      params: Promise.resolve({ organizationId, cycleId: draftId }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.version).toBe(3);
    expect(mocks.replaceGapAnalysisEvidence).toHaveBeenCalledWith({
      userId,
      organizationId,
      draftId,
      expectedLockVersion: 2,
      selectedDocumentIds: [documentId],
    });
  });
});
