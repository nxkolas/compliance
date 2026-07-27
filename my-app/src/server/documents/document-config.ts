import type { AiProviderMode } from "@/lib/ai/types";

export const DOCUMENT_STORAGE_BUCKET = "organization-evidence";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const EMBEDDING_PROVIDER = configuredProvider();
export const EMBEDDING_MODEL = configuredEmbeddingModel(EMBEDDING_PROVIDER);
export const EMBEDDING_MODEL_REVISION =
  configuredValue(
    EMBEDDING_PROVIDER === "self_hosted"
      ? "SELF_HOSTED_AI_EMBEDDING_REVISION"
      : undefined,
  ) ?? EMBEDDING_MODEL;
export const EMBEDDING_DIMENSIONS = configuredEmbeddingDimensions();
export const EMBEDDING_RETRIEVAL_INSTRUCTION_ID =
  EMBEDDING_PROVIDER === "self_hosted" ? "qwen3-query-v1" : "none";
export const CHUNKING_VERSION = "paragraph-v1";

export const SUPPORTED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

function configuredProvider(): AiProviderMode {
  const provider = process.env.AI_DEFAULT_PROVIDER?.trim();
  if (
    provider === "openai" ||
    provider === "self_hosted" ||
    provider === "company_hosted"
  ) {
    return provider;
  }
  return "openai";
}

function configuredEmbeddingModel(provider: AiProviderMode) {
  const variable =
    provider === "self_hosted"
      ? "SELF_HOSTED_AI_EMBEDDING_MODEL"
      : provider === "company_hosted"
        ? "COMPANY_AI_EMBEDDING_MODEL"
        : "OPENAI_EMBEDDING_MODEL";
  return (
    configuredValue(variable) ??
    (provider === "self_hosted"
      ? "compliance-embedding"
      : "text-embedding-3-small")
  );
}

function configuredEmbeddingDimensions() {
  const dimensions = Number(process.env.AI_EMBEDDING_DIM ?? 1536);
  if (dimensions !== 1536) {
    throw new Error("AI_EMBEDDING_DIM must be exactly 1536");
  }
  return dimensions;
}

function configuredValue(name: string | undefined) {
  if (!name) return undefined;
  const value = process.env[name]?.trim();
  return value || undefined;
}
