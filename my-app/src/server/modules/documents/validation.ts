import { ApiError } from "../../platform/http/errors";
import {
  MAX_DOCUMENT_BYTES,
  SUPPORTED_DOCUMENT_TYPES,
} from "./document-config";

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
