export const DOCUMENT_STORAGE_BUCKET = "organization-evidence";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const EMBEDDING_PROVIDER = "openai";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const CHUNKING_VERSION = "paragraph-v1";

export const SUPPORTED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);
