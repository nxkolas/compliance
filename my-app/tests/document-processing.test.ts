import { describe, expect, it } from "vitest";
import {
  chunkExtractedPages,
  parseDocument,
} from "@/src/server/platform/content-processing";
import { validateDocumentUpload } from "@/src/server/modules/documents/validation";

describe("document evidence processing", () => {
  it("accepts and extracts UTF-8 text without OCR", async () => {
    const parsed = await parseDocument(
      new TextEncoder().encode("# Policy\n\nAccess reviews are quarterly."),
      "text/markdown",
      { maxBytes: 10 * 1024 * 1024 },
    );
    expect(parsed.parserKind).toBe("plain-text");
    expect(parsed.text).toContain("Access reviews");
  });

  it("rejects unsupported and oversized uploads", () => {
    expect(() =>
      validateDocumentUpload({ fileName: "scan.png", mimeType: "image/png", byteSize: 10 }),
    ).toThrow(/only text pdf/i);
    expect(() =>
      validateDocumentUpload({ fileName: "large.txt", mimeType: "text/plain", byteSize: 11 * 1024 * 1024 }),
    ).toThrow(/10 MB/);
  });

  it("creates stable page and section locators", () => {
    const chunks = chunkExtractedPages([
      { pageNumber: 2, text: "# Access\nQuarterly reviews.\n\nAll changes are approved." },
    ]);
    expect(chunks).toEqual([
      expect.objectContaining({
        chunkIndex: 0,
        pageNumber: 2,
        sectionLabel: "Access",
      }),
    ]);
  });
});
