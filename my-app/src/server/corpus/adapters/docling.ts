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
  options: { endpoint: string; timeoutMs: number; maxOutputCharacters: number },
): Promise<DoclingResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(options.endpoint, {
      method: "POST",
      headers: { "content-type": mimeType, accept: "application/json" },
      body: Buffer.from(bytes),
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(502, "OCR service failed", undefined, "DOCLING_FAILED");
    const result = await response.json() as DoclingResult;
    if (!result.text || result.text.length > options.maxOutputCharacters) {
      throw new ApiError(422, "OCR output failed quality limits", undefined, "DOCLING_OUTPUT_INVALID");
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
