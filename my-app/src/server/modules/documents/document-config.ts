import type { AiProviderMode } from "@/lib/ai/types";
import { contentHash } from "@/src/server/platform/canonical-json";

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

export type EmbeddingCoordinates = {
  provider: AiProviderMode;
  model: string;
  modelRevision: string;
  dimensions: number;
  retrievalInstructionId: string;
  chunkingVersion: string;
};

export type EmbeddingConfig = EmbeddingCoordinates & {
  /** Hash of the coordinates above. See `embeddingIdentityKey`. */
  key: string;
};

/**
 * Hashes the facts that decide whether two vectors are comparable.
 *
 * A change to any one of them produces a different space: a different model or
 * revision obviously, different output dimensions, a different retrieval
 * instruction prefixed to queries, or a different chunking of the source text.
 * Storing the hash on every `document_versions` row and filtering retrieval on
 * it is what stops a half-finished re-index from mixing two spaces.
 *
 * The fields are listed explicitly rather than spread. Adding a field to
 * `EmbeddingCoordinates` must be a deliberate decision to invalidate every
 * stored vector, not a side effect of widening a type.
 */
export function embeddingIdentityKey(coordinates: EmbeddingCoordinates) {
  return contentHash({
    version: 1,
    provider: coordinates.provider,
    model: coordinates.model,
    modelRevision: coordinates.modelRevision,
    dimensions: coordinates.dimensions,
    retrievalInstructionId: coordinates.retrievalInstructionId,
    chunkingVersion: coordinates.chunkingVersion,
  });
}

/** Attaches the derived key, so a config can never travel without its hash. */
export function withEmbeddingKey(
  coordinates: EmbeddingCoordinates,
): EmbeddingConfig {
  return { ...coordinates, key: embeddingIdentityKey(coordinates) };
}

/**
 * The `document_versions` columns recording which space a row's vectors are in.
 *
 * Every write of those columns goes through here. Setting the key without its
 * components, or components without the key, would produce a row whose stored
 * identity and stored hash disagree -- and the hash is what retrieval filters
 * on, so the row would be silently unreachable or wrongly included.
 *
 * Accepts anything carrying the coordinates, which covers both `EmbeddingConfig`
 * and a live `DocumentEmbeddingProvider`.
 */
export function embeddingIdentityColumns(source: {
  model: string;
  modelRevision: string;
  dimensions: number;
  retrievalInstructionId: string;
  key: string;
}) {
  return {
    embeddingModel: source.model,
    embeddingRevision: source.modelRevision,
    embeddingDimensions: source.dimensions,
    embeddingInstructionProfile: source.retrievalInstructionId,
    embeddingKey: source.key,
  };
}

/**
 * Resolves the embedding coordinates for one provider family. Vectors are only
 * comparable within a single embedding model, so every read and write of a
 * document embedding must resolve this from the same provider mode.
 */
export function resolveEmbeddingConfig(
  providerMode: AiProviderMode = DEFAULT_EMBEDDING_PROVIDER,
): EmbeddingConfig {
  const model = configuredEmbeddingModel(providerMode);
  return withEmbeddingKey({
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
    chunkingVersion: CHUNKING_VERSION,
  });
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
  if (provider === "openai" || provider === "self_hosted") {
    return provider;
  }
  return "openai";
}

function configuredEmbeddingModel(provider: AiProviderMode) {
  const variable =
    provider === "self_hosted"
      ? "SELF_HOSTED_AI_EMBEDDING_MODEL"
      : "OPENAI_EMBEDDING_MODEL";
  return (
    configuredValue(variable) ??
    (provider === "self_hosted"
      ? "compliance-embedding"
      : "text-embedding-3-small")
  );
}

/**
 * The embedding width this deployment declares.
 *
 * No longer pinned to 1536: the storage column is undimensioned and the model
 * is an organization's choice, so the width follows the model rather than the
 * schema. The bounds are pgvector's own storage limit. A model that returns
 * something other than this fails in `adaptEmbeddings` rather than being
 * truncated to fit.
 */
function configuredEmbeddingDimensions() {
  const dimensions = Number(process.env.AI_EMBEDDING_DIM ?? 1536);
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000) {
    throw new Error("AI_EMBEDDING_DIM must be an integer between 1 and 16000");
  }
  return dimensions;
}

function configuredValue(name: string | undefined) {
  if (!name) return undefined;
  const value = process.env[name]?.trim();
  return value || undefined;
}
