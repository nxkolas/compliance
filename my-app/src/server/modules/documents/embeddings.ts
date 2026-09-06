import { embedMany } from "ai";
import { getComplianceEmbeddingModel } from "@/src/server/platform/ai/models";
import type { AiProviderMode } from "@/src/server/platform/ai/types";
import {
  DEFAULT_EMBEDDING_PROVIDER,
  EMBEDDING_DIMENSIONS,
  resolveEmbeddingConfig,
  type EmbeddingConfig,
} from "./document-config";
import { validateEmbeddings } from "../../platform/content-processing/embeddings";
import type { ContentEmbedder } from "../../platform/content-processing/types";

export type EmbeddingPurpose = "document" | "query";

export type DocumentEmbeddingProvider = ContentEmbedder;
export { validateEmbeddings };

/**
 * Builds an embedder for one provider family. Callers holding an organization
 * must pass that organization's `ai_provider_mode`; omitting it falls back
 * to the server default and is only correct where no organization is in scope.
 */
export function createDocumentEmbeddingProvider(
  providerMode: AiProviderMode = DEFAULT_EMBEDDING_PROVIDER,
): DocumentEmbeddingProvider {
  return createDocumentEmbeddingProviderFromConfig(
    resolveEmbeddingConfig(providerMode),
  );
}

/**
 * Builds an embedder from an explicit configuration rather than resolving one.
 *
 * A re-index must embed with the coordinates pinned when it was requested, even
 * if the organization's settings have moved on since. Resolving the current
 * configuration mid-run would write rows labelled with a space they are not in.
 */
export function createDocumentEmbeddingProviderFromConfig(
  config: EmbeddingConfig,
): DocumentEmbeddingProvider {
  return {
    provider: config.provider,
    model: config.model,
    modelRevision: config.modelRevision,
    dimensions: config.dimensions,
    retrievalInstructionId: config.retrievalInstructionId,
    chunkingVersion: config.chunkingVersion,
    key: config.key,
    async embed(values, purpose = "document") {
      if (values.length === 0) return [];
      const result = await embedMany({
        model: getComplianceEmbeddingModel(config.provider),
        values: values.map((value) =>
          embeddingInput(value, purpose, config.retrievalInstructionId),
        ),
      });
      return adaptEmbeddings(result.embeddings, config.dimensions);
    },
  };
}

/**
 * Normalizes model output to unit length and checks it is the declared width.
 *
 * This used to truncate anything wider than the configured dimension, which was
 * safe only because the one supported model was Matryoshka-trained and could be
 * cut without losing its geometry. The model is an organization's own choice
 * now, so that assumption no longer holds: silently truncating a model that was
 * not trained for it degrades retrieval quality with nothing to notice.
 *
 * A width that disagrees with the declared one is therefore an error. The
 * declared width comes from probing the model, so a disagreement means the
 * configuration is describing a different model than the one answering.
 */
export function adaptEmbeddings(
  embeddings: number[][],
  dimensions = EMBEDDING_DIMENSIONS,
) {
  return embeddings.map((embedding) => {
    if (embedding.length !== dimensions) {
      throw new Error(
        `Embedding model returned ${embedding.length} dimensions, but the configuration declares ${dimensions}`,
      );
    }
    return normalizeEmbedding(embedding);
  });
}

export function normalizeEmbedding(embedding: number[]) {
  if (
    embedding.length === 0 ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Embedding contains invalid values");
  }

  const magnitude = Math.hypot(...embedding);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Embedding has zero or invalid norm");
  }

  return embedding.map((value) => value / magnitude);
}

/**
 * Applies the retrieval instruction a model family expects on query text.
 *
 * Keyed on the instruction profile rather than the provider, because the model
 * is an organization's choice: two organizations on the same provider can run
 * embedding models with different conventions. The profile is part of the
 * embedding identity, so a document embedded under one profile is never
 * compared against a query embedded under another.
 *
 * Document text is never prefixed. Qwen3-Embedding and the E5 family instruct
 * on the query side only.
 */
function embeddingInput(
  value: string,
  purpose: EmbeddingPurpose,
  retrievalInstructionId: string,
) {
  if (purpose !== "query") return value;

  if (retrievalInstructionId === "qwen3-query-v1") {
    return [
      "Instruct: Retrieve passages relevant to the compliance question.",
      `Query: ${value}`,
    ].join("\n");
  }

  if (retrievalInstructionId === "e5-query-v1") {
    return `query: ${value}`;
  }

  return value;
}
