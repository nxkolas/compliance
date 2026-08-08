import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/client/client-inference-worker", () => ({
  runClientInferenceWorker: vi.fn(async () => undefined),
}));

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: new MemoryStorage() },
});

import { runClientInferenceWorker } from "@/src/client/client-inference-worker";
import {
  DEFAULT_LOCAL_MODEL_BASE_URL,
  forgetLocalModelBaseUrl,
  getHostWorkerStatus,
  isHostWorkerRunning,
  localModelBaseUrlKey,
  rememberLocalModelBaseUrl,
  rememberedLocalModelBaseUrl,
  startHostWorker,
  stopHostWorker,
} from "@/src/client/client-inference-host";

const ORGANIZATION_ID = "9b837620-e373-4d9a-ab9f-eaa9b4590d14";

describe("client inference relay host", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(runClientInferenceWorker).mockClear();
    stopHostWorker(ORGANIZATION_ID);
  });

  it("remembers the base URL per organization", () => {
    expect(rememberedLocalModelBaseUrl(ORGANIZATION_ID)).toBe(
      DEFAULT_LOCAL_MODEL_BASE_URL,
    );
    rememberLocalModelBaseUrl(ORGANIZATION_ID, "http://127.0.0.1:11434/v1");
    expect(rememberedLocalModelBaseUrl(ORGANIZATION_ID)).toBe(
      "http://127.0.0.1:11434/v1",
    );
    forgetLocalModelBaseUrl(ORGANIZATION_ID);
    expect(rememberedLocalModelBaseUrl(ORGANIZATION_ID)).toBe(
      DEFAULT_LOCAL_MODEL_BASE_URL,
    );
  });

  it("starts one worker per organization and publishes its status", () => {
    startHostWorker(ORGANIZATION_ID, DEFAULT_LOCAL_MODEL_BASE_URL);
    expect(isHostWorkerRunning(ORGANIZATION_ID)).toBe(true);
    expect(runClientInferenceWorker).toHaveBeenCalledTimes(1);

    const input = vi.mocked(runClientInferenceWorker).mock.calls[0]![0];
    expect(input.organizationId).toBe(ORGANIZATION_ID);
    input.onStatus?.({ state: "working", kind: "generation" });
    expect(getHostWorkerStatus(ORGANIZATION_ID)).toEqual({
      state: "working",
      kind: "generation",
    });
  });

  it("does not restart a worker for the same base URL", () => {
    startHostWorker(ORGANIZATION_ID, DEFAULT_LOCAL_MODEL_BASE_URL);
    startHostWorker(ORGANIZATION_ID, DEFAULT_LOCAL_MODEL_BASE_URL);
    expect(runClientInferenceWorker).toHaveBeenCalledTimes(1);
  });

  it("restarts the worker when the base URL changes", () => {
    startHostWorker(ORGANIZATION_ID, DEFAULT_LOCAL_MODEL_BASE_URL);
    startHostWorker(ORGANIZATION_ID, "http://127.0.0.1:11435/v1");
    expect(runClientInferenceWorker).toHaveBeenCalledTimes(2);
    const lastInput = vi.mocked(runClientInferenceWorker).mock.calls[1]![0];
    expect(lastInput.target.baseUrl).toBe("http://127.0.0.1:11435/v1");
  });

  it("stops the worker and clears its status", () => {
    startHostWorker(ORGANIZATION_ID, DEFAULT_LOCAL_MODEL_BASE_URL);
    stopHostWorker(ORGANIZATION_ID);
    expect(isHostWorkerRunning(ORGANIZATION_ID)).toBe(false);
    expect(getHostWorkerStatus(ORGANIZATION_ID)).toEqual({ state: "idle" });
  });

  it("forgets a relay whose organization is no longer available", () => {
    rememberLocalModelBaseUrl(ORGANIZATION_ID, DEFAULT_LOCAL_MODEL_BASE_URL);
    startHostWorker(ORGANIZATION_ID, DEFAULT_LOCAL_MODEL_BASE_URL);

    const input = vi.mocked(runClientInferenceWorker).mock.calls[0]![0];
    input.onOrganizationUnavailable?.();

    expect(rememberedLocalModelBaseUrl(ORGANIZATION_ID)).toBe(
      DEFAULT_LOCAL_MODEL_BASE_URL,
    );
    expect(
      window.localStorage.getItem(localModelBaseUrlKey(ORGANIZATION_ID)),
    ).toBeNull();
    expect(isHostWorkerRunning(ORGANIZATION_ID)).toBe(false);
  });
});
