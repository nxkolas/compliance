import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  enforceOperationRateLimit: vi.fn(),
  assertCanAccessOrganization: vi.fn(),
  claimClientInference: vi.fn(),
  submitClientInference: vi.fn(),
  failClientInference: vi.fn(),
  wakeParkedJob: vi.fn(),
}));

vi.mock("@/src/server/api/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));
vi.mock("@/src/server/api/operation-rate-limit", () => ({
  enforceOperationRateLimit: mocks.enforceOperationRateLimit,
}));
vi.mock("@/src/server/organizations/service", () => ({
  assertCanAccessOrganization: mocks.assertCanAccessOrganization,
}));
vi.mock("@/src/server/ai/client-inference/service", () => ({
  claimClientInference: mocks.claimClientInference,
  heartbeatClientInference: vi.fn(),
  submitClientInference: mocks.submitClientInference,
  failClientInference: mocks.failClientInference,
}));
vi.mock("@/src/server/jobs", () => ({ wakeParkedJob: mocks.wakeParkedJob }));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: vi.fn() };
});

import { POST as claimPOST } from "@/app/api/organizations/[organizationId]/client-inference/claim/route";
import { POST as resultPOST } from "@/app/api/organizations/[organizationId]/client-inference/[requestId]/result/route";
import { POST as failurePOST } from "@/app/api/organizations/[organizationId]/client-inference/[requestId]/failure/route";
import { ApiError } from "@/src/server/api/errors";

const ORGANIZATION_ID = "9b837620-e373-4d9a-ab9f-eaa9b4590d14";
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

function context() {
  return {
    params: Promise.resolve({
      organizationId: ORGANIZATION_ID,
      requestId: REQUEST_ID,
    }),
  };
}

describe("client-inference route hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.enforceOperationRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      retryAfterSeconds: 0,
    });
    mocks.assertCanAccessOrganization.mockResolvedValue({});
    mocks.claimClientInference.mockResolvedValue(null);
    mocks.submitClientInference.mockResolvedValue({
      id: REQUEST_ID,
      jobId: null,
      status: "succeeded",
    });
    mocks.failClientInference.mockResolvedValue({
      id: REQUEST_ID,
      jobId: null,
      status: "failed",
    });
  });

  it("rate-limits claim per user and organization", async () => {
    const response = await claimPOST(
      new Request("http://localhost/api/claim", { method: "POST" }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(mocks.enforceOperationRateLimit).toHaveBeenCalledWith({
      userId: "user-1",
      operation: "client-inference:claim",
      scopeId: ORGANIZATION_ID,
    });
  });

  it("surfaces a claim rate-limit rejection as 429", async () => {
    mocks.enforceOperationRateLimit.mockRejectedValue(
      new ApiError(429, "Too many requests", undefined, "RATE_LIMITED"),
    );

    const response = await claimPOST(
      new Request("http://localhost/api/claim", { method: "POST" }),
      context(),
    );

    expect(response.status).toBe(429);
    expect(mocks.claimClientInference).not.toHaveBeenCalled();
  });

  it("rejects an oversized failure body with 413", async () => {
    const response = await failurePOST(
      new Request("http://localhost/api/failure", {
        method: "POST",
        body: JSON.stringify({
          failureCode: "LOCAL_MODEL_ERROR",
          failureMessage: "x".repeat(17 * 1024),
        }),
      }),
      context(),
    );

    expect(response.status).toBe(413);
    expect(mocks.failClientInference).not.toHaveBeenCalled();
  });

  it("accepts a normal result and submits it", async () => {
    const response = await resultPOST(
      new Request("http://localhost/api/result", {
        method: "POST",
        body: JSON.stringify({ output: { answer: "ok" } }),
      }),
      context(),
    );

    expect(response.status).toBe(202);
    expect(mocks.submitClientInference).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: REQUEST_ID,
        response: { answer: "ok" },
      }),
    );
  });
});
