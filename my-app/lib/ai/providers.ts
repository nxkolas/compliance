import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { ApiError } from "@/src/server/api/errors";
import { aiProviderModes, type AiProviderMode } from "./types";

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function requireEnv(name: string) {
  const value = optionalEnv(name);

  if (!value) {
    throw new ApiError(500, `${name} is not configured`);
  }

  return value;
}

function requireAbsoluteUrl(name: string) {
  const value = requireEnv(name);

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must use http or https");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    throw new ApiError(
      500,
      `${name} must be an absolute URL, for example https://api.example.com/v1`,
    );
  }
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

export function getDefaultAiProviderMode(): AiProviderMode {
  const configuredDefault = optionalEnv("AI_DEFAULT_PROVIDER");

  if (isAiProviderMode(configuredDefault)) {
    return configuredDefault;
  }

  return "openai";
}

export function getChatProvider() {
  return createOpenAICompatible({
    name: "compliance-chat",
    baseURL: requireAbsoluteUrl("AI_CHAT_BASE_URL"),
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
    baseURL: requireAbsoluteUrl("SELF_HOSTED_AI_BASE_URL"),
    apiKey: requireEnv("SELF_HOSTED_AI_API_KEY"),
  });
}

export function getCompanyHostedChatProvider() {
  return createOpenAICompatible({
    name: "company-hosted",
    baseURL: requireAbsoluteUrl("COMPANY_AI_BASE_URL"),
    apiKey: requireEnv("COMPANY_AI_API_KEY"),
  });
}

export function getEmbeddingProvider() {
  return createOpenAICompatible({
    name: "compliance-embeddings",
    baseURL: requireAbsoluteUrl("AI_EMBEDDING_BASE_URL"),
    apiKey: requireEnv("AI_EMBEDDING_API_KEY"),
  });
}

function isAiProviderMode(value: unknown): value is AiProviderMode {
  return (
    typeof value === "string" &&
    aiProviderModes.includes(value as AiProviderMode)
  );
}
