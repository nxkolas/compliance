import { afterEach, describe, expect, it, vi } from "vitest";

type BuiltinModuleHost = {
  getBuiltinModule?: (name: string) => unknown;
};

describe("pdf-parse DOMMatrix polyfill", () => {
  it("documents the Vercel failure mode: pdf-parse cannot load without a DOMMatrix global", async () => {
    // pdfjs polyfills DOMMatrix via process.getBuiltinModule("module")
    // (Node >= 20.16). Removing it mirrors runtimes where that path is
    // unavailable, e.g. Vercel on an older Node runtime.
    const processHost = process as unknown as BuiltinModuleHost;
    const original = processHost.getBuiltinModule;
    processHost.getBuiltinModule = undefined;
    try {
      await expect(import("pdf-parse")).rejects.toThrow(/DOMMatrix is not defined/u);
    } finally {
      processHost.getBuiltinModule = original;
    }
  });
});

afterEach(() => {
  // Keep the failed module evaluation out of any later test in this worker.
  vi.resetModules();
});
