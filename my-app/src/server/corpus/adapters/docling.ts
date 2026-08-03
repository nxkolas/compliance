import { ApiError } from "@/src/server/api/errors";

export type DoclingResult = {
  text: string;
  pages: Array<{ pageNumber: number; text: string }>;
  anchorsReliable: boolean;
  metadata: Record<string, unknown>;
};

export async function parseWithDocling(
  bytes: Uint8Array,
  mimeType: string,
  options: {
    endpoint: string;
    timeoutMs: number;
    maxOutputCharacters: number;
    signal?: AbortSignal;
  },
): Promise<DoclingResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const payload = new Uint8Array(bytes.byteLength);
    payload.set(bytes);
    const form = new FormData();
    form.append(
      "files",
      new Blob([payload.buffer], { type: mimeType }),
      filenameForMimeType(mimeType),
    );
    form.append("to_formats", "md");
    form.append("do_ocr", "true");
    form.append("image_export_mode", "placeholder");
    form.append("table_mode", "accurate");
    const response = await fetch(conversionEndpoint(options.endpoint), {
      method: "POST",
      headers: { accept: "application/json" },
      body: form,
      signal: options.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal,
    });
    if (!response.ok) throw new ApiError(502, "OCR service failed", undefined, "DOCLING_FAILED");
    const result = await response.json() as {
      status?: string;
      processing_time?: number;
      errors?: unknown[];
      document?: {
        md_content?: string;
        text_content?: string;
      };
    };
    const text = result.document?.md_content ?? result.document?.text_content;
    if (
      !["success", "partial_success"].includes(result.status ?? "") ||
      !text ||
      text.length > options.maxOutputCharacters
    ) {
      throw new ApiError(422, "OCR output failed quality limits", undefined, "DOCLING_OUTPUT_INVALID");
    }
    return {
      text,
      pages: [{ pageNumber: 1, text }],
      anchorsReliable: false,
      metadata: {
        status: result.status,
        processingTimeSeconds: result.processing_time ?? null,
        errorCount: result.errors?.length ?? 0,
        outputFormat: "markdown",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function conversionEndpoint(endpoint: string) {
  const base = endpoint.replace(/\/+$/, "");
  return base.endsWith("/v1/convert/file")
    ? base
    : `${base}/v1/convert/file`;
}

function filenameForMimeType(mimeType: string) {
  switch (mimeType.toLowerCase()) {
    case "application/pdf":
      return "document.pdf";
    case "text/html":
      return "document.html";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "document.docx";
    default:
      return "document.bin";
  }
}
