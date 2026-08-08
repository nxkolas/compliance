import { applicabilityCheckClient } from "@/src/client/applicability-check";
import { afterEach, describe, expect, it, vi } from "vitest";

const organizationId = "11111111-1111-4111-8111-111111111111";
const checkId = "22222222-2222-4222-8222-222222222222";

const claimedResult = {
  outputRevisionId: "33333333-3333-4333-8333-333333333333",
  outputRevisionNumber: 1,
  createdAt: "2026-08-08T10:00:00.000Z",
  assessmentRevisionId: "44444444-4444-4444-8444-444444444444",
  evidence: { outcome: "important_entity" },
  result: { outcome: "important_entity" },
  definition: {
    hash: "definition-hash",
    versionLabel: "2026-v1",
    isOutdated: false,
    supportedJurisdictionCodes: ["DE"],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applicability check client", () => {
  it("accepts the successful guest-claim response returned by the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: { result: claimedResult },
        meta: { requestId: "claim-request" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      applicabilityCheckClient.claim({ organizationId, checkId }),
    ).resolves.toMatchObject({
      data: { result: claimedResult },
      status: 200,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/guest/applicability-check/claim",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ organizationId, checkId }),
      }),
    );
  });
});
