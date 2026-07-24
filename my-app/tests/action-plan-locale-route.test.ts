import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  claimIdempotency: vi.fn(),
  failIdempotency: vi.fn(),
  finalize: vi.fn(),
  getCurrentActionPlan: vi.fn(),
  getActionPlanDetail: vi.fn(),
  getLocale: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/i18n", () => ({ getLocale: mocks.getLocale }));
vi.mock("@/src/server/api/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("@/src/server/api/idempotency", () => ({
  claimIdempotency: mocks.claimIdempotency,
  failIdempotency: mocks.failIdempotency,
  fingerprintRequest: vi.fn(() => "fingerprint"),
  requireIdempotencyKey: vi.fn(() => "command-key"),
}));
vi.mock("@/src/server/action-plans", () => ({
  getCurrentActionPlan: mocks.getCurrentActionPlan,
  getActionPlanDetail: mocks.getActionPlanDetail,
}));
vi.mock("@/src/server/gap-analysis", () => ({
  finalizeGapAnalysisAndGenerateActionPlan: mocks.finalize,
}));
vi.mock("@/src/server/idempotency", () => ({
  databaseIdempotencyRepository: {},
}));

import { POST } from "@/app/api/organizations/[organizationId]/action-plan/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const revisionId = "00000000-0000-4000-8000-000000000003";
const planId = "00000000-0000-4000-8000-000000000004";

describe("action-plan locale pinning route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.getLocale.mockResolvedValue("en");
    mocks.claimIdempotency.mockResolvedValue({
      kind: "claimed",
      record: {
        actorKey: userId,
        scope: organizationId,
        operation: "action-plan.generate",
        key: "command-key",
        requestFingerprint: "fingerprint",
      },
    });
    mocks.finalize.mockResolvedValue({
      plan: {
        id: planId,
        version: 1,
        outputLocale: "de",
      },
      revision: { id: revisionId },
      itemCount: 1,
    });
  });

  it("finalizes from revision metadata without reading or forwarding the UI locale", async () => {
    const response = await POST(
      new Request(
        `http://localhost/api/organizations/${organizationId}/action-plan`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ gapRevisionId: revisionId }),
        },
      ),
      { params: Promise.resolve({ organizationId }) },
    );
    expect(response.status).toBe(201);
    expect(mocks.getLocale).not.toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        organizationId,
        gapRevisionId: revisionId,
      }),
    );
    expect(mocks.finalize).toHaveBeenCalledWith(
      expect.not.objectContaining({ locale: expect.anything() }),
    );
  });
});
