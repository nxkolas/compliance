import { embedMany } from "ai";
import { getOpenAIProvider } from "@/lib/ai/providers";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
} from "./document-config";

export type DocumentEmbeddingProvider = {
  provider: string;
  model: string;
  dimensions: number;
  embed(values: string[]): Promise<number[][]>;
};

export function createDocumentEmbeddingProvider(): DocumentEmbeddingProvider {
  return {
    provider: EMBEDDING_PROVIDER,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(values) {
      if (values.length === 0) return [];
      const result = await embedMany({
        model: getOpenAIProvider().embeddingModel(EMBEDDING_MODEL),
        values,
      });
      return result.embeddings;
    },
  };
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
    if (
      embedding.length !== expectedDimensions ||
      embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Embedding dimensions do not match the configured space");
    }
  }
}
