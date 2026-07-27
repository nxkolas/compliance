import { afterEach, describe, expect, it, vi } from "vitest";
import { parseWithDocling } from "@/src/server/corpus/adapters/docling";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Docling adapter", () => {
  it("uses the v1 multipart conversion contract and projects safe output", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get("files")).toBeInstanceOf(Blob);
      expect(form.get("to_formats")).toBe("md");
      expect(form.get("do_ocr")).toBe("true");
      return Response.json({
        status: "success",
        processing_time: 1.25,
        errors: [],
        document: { md_content: "# Converted evidence" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseWithDocling(
      new TextEncoder().encode("fixture"),
      "application/pdf",
      {
        endpoint: "http://docling:5001/",
        timeoutMs: 1_000,
        maxOutputCharacters: 10_000,
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://docling:5001/v1/convert/file",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({
      text: "# Converted evidence",
      pages: [{ pageNumber: 1, text: "# Converted evidence" }],
      anchorsReliable: false,
      metadata: {
        status: "success",
        processingTimeSeconds: 1.25,
        errorCount: 0,
        outputFormat: "markdown",
      },
    });
  });

  it("rejects failed or oversized conversion output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "failure",
          document: { md_content: "untrusted output" },
        }),
      ),
    );

    await expect(
      parseWithDocling(new Uint8Array([1]), "application/pdf", {
        endpoint: "http://docling:5001/v1/convert/file",
        timeoutMs: 1_000,
        maxOutputCharacters: 10,
      }),
    ).rejects.toMatchObject({ code: "DOCLING_OUTPUT_INVALID" });
  });
});
