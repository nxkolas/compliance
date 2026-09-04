export const LEGAL_CORPUS_BUCKET = "legal-corpus";
export const MAX_LEGAL_SOURCE_BYTES = 50 * 1024 * 1024;
export const LEGAL_SOURCE_UPLOAD_TTL_SECONDS = 10 * 60;
export const LEGAL_SOURCE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);
