import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ApiError } from "../api/errors";
import { MAX_DOCUMENT_BYTES, SUPPORTED_DOCUMENT_TYPES } from "./document-config";

export type ExtractedPage = {
  pageNumber: number | null;
  text: string;
};

export type ParsedDocument = {
  parserKind: "pdf-parse" | "mammoth" | "plain-text";
  parserVersion: "v1";
  pages: ExtractedPage[];
  text: string;
  metadata: Record<string, unknown>;
};

export function validateDocumentUpload(input: {
  fileName: string;
  mimeType: string;
  byteSize: number;
}) {
  if (!input.fileName.trim()) throw new ApiError(400, "A file name is required");
  if (!SUPPORTED_DOCUMENT_TYPES.has(input.mimeType)) {
    throw new ApiError(415, "Only text PDF, DOCX, TXT, and Markdown files are supported");
  }
  if (!Number.isInteger(input.byteSize) || input.byteSize < 1) {
    throw new ApiError(400, "The document is empty");
  }
  if (input.byteSize > MAX_DOCUMENT_BYTES) {
    throw new ApiError(413, "The document exceeds the 10 MB limit");
  }
}

export async function parseDocument(
  bytes: Uint8Array,
  mimeType: string,
  options: { maxBytes?: number } = {},
): Promise<ParsedDocument> {
  if (options.maxBytes === undefined) {
    validateDocumentUpload({ fileName: "upload", mimeType, byteSize: bytes.byteLength });
  } else if (bytes.byteLength < 1 || bytes.byteLength > options.maxBytes) {
    throw new ApiError(413, "The document size is not allowed");
  }
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      const pages = result.pages.map((page) => ({
        pageNumber: page.num,
        text: normalizeText(page.text),
      }));
      return requireExtractedText({
        parserKind: "pdf-parse",
        parserVersion: "v1",
        pages,
        text: pages.map((page) => page.text).join("\n\n"),
        metadata: { pageCount: result.total },
      });
    } finally {
      await parser.destroy();
    }
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = normalizeText(result.value);
    return requireExtractedText({
      parserKind: "mammoth",
      parserVersion: "v1",
      pages: [{ pageNumber: null, text }],
      text,
      metadata: { warnings: result.messages.map((message) => message.message) },
    });
  }
  const text = normalizeText(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  return requireExtractedText({
    parserKind: "plain-text",
    parserVersion: "v1",
    pages: [{ pageNumber: null, text }],
    text,
    metadata: {},
  });
}

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function requireExtractedText(document: ParsedDocument) {
  if (!document.text.trim()) {
    throw new ApiError(
      422,
      "No text could be extracted; scanned documents and OCR are not supported",
    );
  }
  return document;
}
