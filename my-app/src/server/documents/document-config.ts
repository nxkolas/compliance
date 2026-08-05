import type { AiProviderMode } from "@/lib/ai/types";

export const DOCUMENT_STORAGE_BUCKET = "organization-evidence";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const EMBEDDING_DIMENSIONS = configuredEmbeddingDimensions();
export const CHUNKING_VERSION = "paragraph-v1";

/**
 * Server-wide fallback embedding provider. Organizations carry their own
 * `ai_provider_mode`; this is only used where no organization is in scope,
 * such as legal corpus provisioning and operator commands.
 */
export const DEFAULT_EMBEDDING_PROVIDER = configuredProvider();

export type EmbeddingConfig = {
  provider: AiProviderMode;
  model: string;
  modelRevision: string;
  dimensions: number;
  retrievalInstructionId: string;
};

/**
 * Resolves the embedding coordinates for one provider family. Vectors are only
 * comparable within a single embedding model, so every read and write of a
 * document embedding must resolve this from the same provider mode.
 */
export function resolveEmbeddingConfig(
  providerMode: AiProviderMode = DEFAULT_EMBEDDING_PROVIDER,
): EmbeddingConfig {
  const model = configuredEmbeddingModel(providerMode);
  return {
    provider: providerMode,
    model,
    modelRevision:
      configuredValue(
        providerMode === "self_hosted"
          ? "SELF_HOSTED_AI_EMBEDDING_REVISION"
          : undefined,
      ) ?? model,
    dimensions: EMBEDDING_DIMENSIONS,
    retrievalInstructionId:
      providerMode === "self_hosted" ? "qwen3-query-v1" : "none",
  };
}

const defaultEmbeddingConfig = resolveEmbeddingConfig();

export const EMBEDDING_PROVIDER = defaultEmbeddingConfig.provider;
export const EMBEDDING_MODEL = defaultEmbeddingConfig.model;
export const EMBEDDING_MODEL_REVISION = defaultEmbeddingConfig.modelRevision;
export const EMBEDDING_RETRIEVAL_INSTRUCTION_ID =
  defaultEmbeddingConfig.retrievalInstructionId;

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
