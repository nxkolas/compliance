import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("PDF worker deployment", () => {
  it("includes the PDF.js worker in every server trace", () => {
    expect(nextConfig.outputFileTracingIncludes).toEqual({
      "/*": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    });
  });
});
