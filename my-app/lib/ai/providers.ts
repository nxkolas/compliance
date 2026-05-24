import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ApiError } from "@/src/server/api/errors";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new ApiError(500, `${name} is not configured`);
  }

  return value;
}

export function getChatModelName() {
  return requireEnv("AI_CHAT_MODEL");
}

export function getSmallChatModelName() {
  return process.env.AI_CHAT_SMALL_MODEL ?? getChatModelName();
}

export function getEmbeddingModelName() {
  return requireEnv("AI_EMBEDDING_MODEL");
}

export function getEmbeddingDimensions() {
  return Number(process.env.AI_EMBEDDING_DIM ?? 1536);
}

export function getChatProvider() {
  return createOpenAICompatible({
    name: "compliance-chat",
    baseURL: requireEnv("AI_CHAT_BASE_URL"),
    apiKey: requireEnv("AI_CHAT_API_KEY"),
  });
}

export function getEmbeddingProvider() {
  return createOpenAICompatible({
    name: "compliance-embeddings",
    baseURL: requireEnv("AI_EMBEDDING_BASE_URL"),
    apiKey: requireEnv("AI_EMBEDDING_API_KEY"),
  });
}
