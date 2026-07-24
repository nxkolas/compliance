import { beforeEach, describe, expect, it, vi } from "vitest";
import { gapGenerationEnqueueResponseSchema, isRetryableGapReassessmentStatus } from "@/src/contracts/gap-analysis/generation";
import { invokeRouteContract } from "./support/route-contract";
import { buildGapGenerationEnqueueFingerprint } from "@/src/server/gap-analysis/generation-identity";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  generateGapReassessment: vi.fn(),
  retryGapReassessment: vi.fn(),
  getLocale: vi.fn(),
  revalidatePath: vi.fn(),
  enforceOperationRateLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/i18n", () => ({ getLocale: mocks.getLocale }));
vi.mock("@/src/server/api/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/src/server/api/operation-rate-limit", () => ({ enforceOperationRateLimit: mocks.enforceOperationRateLimit }));
vi.mock("@/src/server/gap-analysis", () => ({
  generateGapReassessment: mocks.generateGapReassessment,
  retryGapReassessment: mocks.retryGapReassessment,
}));

import { POST } from "@/app/api/organizations/[organizationId]/gap-analysis/reassessment/generate/route";
import { POST as RETRY } from "@/app/api/organizations/[organizationId]/gap-analysis/reassessment/retry/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const draftId = "00000000-0000-4000-8000-000000000003";
const jobId = "00000000-0000-4000-8000-000000000004";

describe("gap generation enqueue route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.getLocale.mockResolvedValue("de");
    mocks.generateGapReassessment.mockResolvedValue({
      draft: {
        id: draftId,
        status: "locked",
        outputLocale: "de",
        lockVersion: 2,
        generationJobId: jobId,
        aiProcessingRunId: null,
        outputGapRevisionId: null,
      },
      job: {
        id: jobId,
        kind: "gap-generation",
        state: "queued",
        progress: 0,
        attemptCount: 0,
        safeError: null,
        createdAt: "2026-07-22T12:00:00.000Z",
        updatedAt: "2026-07-22T12:00:00.000Z",
        startedAt: null,
        finishedAt: null,
        cancellable: true,
        resultLink: null,
      },
      reused: false,
    });
    mocks.retryGapReassessment.mockImplementation((input) =>
      mocks.generateGapReassessment(input),
    );
  });

  it("returns the locked draft and common job with 202", async () => {
    const request = new Request(`http://localhost/api/organizations/${organizationId}/gap-analysis/reassessment/generate`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "generate-1", "x-request-id": "gap-job-test" },
      body: JSON.stringify({ draftId, expectedLockVersion: 1 }),
    });
    const result = await invokeRouteContract({
      handler: POST,
      context: { params: Promise.resolve({ organizationId }) },
      request,
      outputSchema: gapGenerationEnqueueResponseSchema,
    });
    expect(result.response.status).toBe(202);
    expect(result.parsed.data.job.id).toBe(jobId);
    expect(result.parsed.data.draft.status).toBe("locked");
    expect(result.parsed.data.draft.outputLocale).toBe("de");
    expect(mocks.generateGapReassessment).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "generate-1",
      organizationId,
      userId,
    }));
  });

  it("does not read the current UI locale when retrying pinned work", async () => {
    mocks.getLocale.mockClear();
    const request = new Request(
      `http://localhost/api/organizations/${organizationId}/gap-analysis/reassessment/retry`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "retry-1",
        },
        body: JSON.stringify({ draftId, retryNonce: "retry-1" }),
      },
    );
    const result = await invokeRouteContract({
      handler: RETRY,
      context: { params: Promise.resolve({ organizationId }) },
      request,
      outputSchema: gapGenerationEnqueueResponseSchema,
    });
    expect(result.response.status).toBe(202);
    expect(mocks.getLocale).not.toHaveBeenCalled();
    expect(mocks.retryGapReassessment).toHaveBeenCalledWith(
      expect.not.objectContaining({ locale: expect.anything() }),
    );
  });

  it("fails safely before enqueue when Idempotency-Key is missing", async () => {
    const response = await POST(new Request(`http://localhost/api/organizations/${organizationId}/gap-analysis/reassessment/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId, expectedLockVersion: 1 }),
    }), { params: Promise.resolve({ organizationId }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "IDEMPOTENCY_KEY_REQUIRED" } });
    expect(mocks.generateGapReassessment).not.toHaveBeenCalled();
  });

  it("allows both failed and cancelled generations to be retried", () => {
    expect(isRetryableGapReassessmentStatus("failed")).toBe(true);
    expect(isRetryableGapReassessmentStatus("cancelled")).toBe(true);
    expect(isRetryableGapReassessmentStatus("locked")).toBe(false);
  });

  it("includes the pinned locale in the enqueue fingerprint", () => {
    const common = {
      draftId,
      expectedLockVersion: 1,
      retryNonce: "retry-1",
    };
    expect(
      buildGapGenerationEnqueueFingerprint({
        ...common,
        outputLocale: "de",
      }),
    ).not.toBe(
      buildGapGenerationEnqueueFingerprint({
        ...common,
        outputLocale: "en",
      }),
    );
  });
});
