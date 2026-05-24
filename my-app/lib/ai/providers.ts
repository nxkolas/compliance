import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
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

export function getOpenAIProvider() {
  return createOpenAI({
    apiKey: requireEnv("OPENAI_API_KEY"),
  });
}

export function getAnthropicProvider() {
  return createAnthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  });
}

export function getSelfHostedChatProvider() {
  return createOpenAICompatible({
    name: "self-hosted",
    baseURL: requireEnv("SELF_HOSTED_AI_BASE_URL"),
    apiKey: requireEnv("SELF_HOSTED_AI_API_KEY"),
  });
}

export function getCompanyHostedChatProvider() {
  return createOpenAICompatible({
    name: "company-hosted",
    baseURL: process.env.COMPANY_AI_BASE_URL ?? requireEnv("AI_CHAT_BASE_URL"),
    apiKey: process.env.COMPANY_AI_API_KEY ?? requireEnv("AI_CHAT_API_KEY"),
  });
}

export function getEmbeddingProvider() {
  return createOpenAICompatible({
    name: "compliance-embeddings",
    baseURL: requireEnv("AI_EMBEDDING_BASE_URL"),
    apiKey: requireEnv("AI_EMBEDDING_API_KEY"),
  });
}
