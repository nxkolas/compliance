import { afterEach, describe, expect, it, vi } from "vitest";
import { installPdfPolyfills } from "@/src/server/platform/content-processing/pdf-polyfills";

type BuiltinModuleHost = {
  getBuiltinModule?: (name: string) => unknown;
};

describe("pdf-parse DOMMatrix polyfill", () => {
  it("loads pdf-parse after installPdfPolyfills even when the native polyfill path is unavailable", async () => {
    const processHost = process as unknown as BuiltinModuleHost;
    const original = processHost.getBuiltinModule;
    processHost.getBuiltinModule = undefined;
    try {
      installPdfPolyfills();
      const pdfParse = await import("pdf-parse");
      expect(typeof pdfParse.PDFParse).toBe("function");
    } finally {
      processHost.getBuiltinModule = original;
    }
  });
});

afterEach(() => {
  vi.resetModules();
});
