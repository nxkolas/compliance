import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock("@/src/client/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/client/api-client")>()),
  request: mocks.request,
}));

vi.mock("@/src/client/local-model", () => ({
  runLocalEmbedding: vi.fn(),
  runLocalGeneration: vi.fn(),
}));

import { ApiClientError } from "@/src/client/api-client";
import { runClientInferenceWorker } from "@/src/client/client-inference-worker";

describe("client inference worker polling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("stops polling when its remembered organization no longer exists", async () => {
    vi.useFakeTimers();
    mocks.request.mockRejectedValue(
      new ApiClientError(
        404,
        "ORGANIZATION_NOT_FOUND",
        "Organization not found",
        undefined,
        "request-1",
      ),
    );
    const controller = new AbortController();

    const worker = runClientInferenceWorker({
      organizationId: "9b837620-e373-4d9a-ab9f-eaa9b4590d14",
      target: { baseUrl: "http://127.0.0.1:11434/v1" },
      signal: controller.signal,
      idleDelayMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.request).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(mocks.request).toHaveBeenCalledTimes(1);

    controller.abort();
    await worker;
  });

  it("continues polling after a transient API failure", async () => {
    vi.useFakeTimers();
    mocks.request.mockRejectedValue(
      new ApiClientError(
        503,
        "SERVICE_UNAVAILABLE",
        "Try again later",
        undefined,
        "request-1",
      ),
    );
    const controller = new AbortController();

    const worker = runClientInferenceWorker({
      organizationId: "9b837620-e373-4d9a-ab9f-eaa9b4590d14",
      target: { baseUrl: "http://127.0.0.1:11434/v1" },
      signal: controller.signal,
      idleDelayMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.request).toHaveBeenCalledTimes(2);

    controller.abort();
    await worker;
  });
});
