import { embedMany } from "ai";
import { getComplianceEmbeddingModel } from "@/lib/ai/models";
import type { AiProviderMode } from "@/lib/ai/types";
import {
  DEFAULT_EMBEDDING_PROVIDER,
  EMBEDDING_DIMENSIONS,
  resolveEmbeddingConfig,
} from "./document-config";

export type EmbeddingPurpose = "document" | "query";

export type DocumentEmbeddingProvider = {
  provider: string;
  model: string;
  modelRevision: string;
  dimensions: number;
  retrievalInstructionId: string;
  embed(values: string[], purpose?: EmbeddingPurpose): Promise<number[][]>;
};

/**
 * Builds an embedder for one provider family. Callers holding an organization
 * must pass that organization's `ai_provider_mode`; omitting it falls back
 * to the server default and is only correct where no organization is in scope.
 */
export function createDocumentEmbeddingProvider(
  providerMode: AiProviderMode = DEFAULT_EMBEDDING_PROVIDER,
): DocumentEmbeddingProvider {
  const config = resolveEmbeddingConfig(providerMode);
  return {
    provider: config.provider,
    model: config.model,
    modelRevision: config.modelRevision,
    dimensions: config.dimensions,
    retrievalInstructionId: config.retrievalInstructionId,
    async embed(values, purpose = "document") {
      if (values.length === 0) return [];
      const result = await embedMany({
        model: getComplianceEmbeddingModel(config.provider),
        values: values.map((value) =>
          embeddingInput(value, purpose, config.provider),
        ),
      });
      return adaptEmbeddings(result.embeddings, config.dimensions);
    },
  };
}

export function adaptEmbeddings(
  embeddings: number[][],
  dimensions = EMBEDDING_DIMENSIONS,
) {
  return embeddings.map((embedding) => {
    const native = normalizeEmbedding(embedding);
    if (native.length < dimensions) {
      throw new Error("Embedding dimensions do not match the configured space");
    }
    return normalizeEmbedding(native.slice(0, dimensions));
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

export function validateEmbeddings(
  embeddings: number[][],
  expectedCount: number,
  expectedDimensions: number,
) {
  if (embeddings.length !== expectedCount) {
    throw new Error("Embedding result count does not match the requested chunks");
  }
  for (const embedding of embeddings) {
    const magnitude = Math.hypot(...embedding);
    if (
      embedding.length !== expectedDimensions ||
      embedding.some((value) => !Number.isFinite(value)) ||
      !Number.isFinite(magnitude) ||
      magnitude === 0
    ) {
      throw new Error("Embedding dimensions do not match the configured space");
    }
  }
}

function embeddingInput(
  value: string,
  purpose: EmbeddingPurpose,
  provider: string,
) {
  if (purpose !== "query" || provider !== "self_hosted") {
    return value;
  }

  return [
    "Instruct: Retrieve passages relevant to the compliance question.",
    `Query: ${value}`,
  ].join("\n");
}
