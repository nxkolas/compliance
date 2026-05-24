import { ApiError } from "@/src/server/api/errors";
import {
  getAnthropicProvider,
  getCompanyHostedChatProvider,
  getOpenAIProvider,
  getSelfHostedChatProvider,
} from "./providers";
import type { AiProviderMode } from "./types";

export function getComplianceChatModel(providerMode: AiProviderMode) {
  const modelId = getChatModelId(providerMode);
  return getComplianceChatModelById(providerMode, modelId);
}

export function getComplianceChatModelById(
  providerMode: AiProviderMode,
  modelId: string,
) {
  if (providerMode === "openai") {
    return getOpenAIProvider()(modelId);
  }

  if (providerMode === "anthropic") {
    return getAnthropicProvider()(modelId);
  }

  if (providerMode === "self_hosted") {
    return getSelfHostedChatProvider()(modelId);
  }

  return getCompanyHostedChatProvider()(modelId);
}

export function getComplianceEmbeddingModel(providerMode: AiProviderMode) {
  if (providerMode === "openai") {
    return getOpenAIProvider().embeddingModel(
      requireModelEnv("OPENAI_EMBEDDING_MODEL"),
    );
  }

  if (providerMode === "anthropic") {
    throw new ApiError(
      400,
      "Anthropic does not provide embeddings in this app. Choose a provider with an embedding model for document RAG.",
    );
  }

  if (providerMode === "self_hosted") {
    return getSelfHostedChatProvider().embeddingModel(
      requireModelEnv("SELF_HOSTED_AI_EMBEDDING_MODEL"),
    );
  }

  return getCompanyHostedChatProvider().embeddingModel(
    requireModelEnv("COMPANY_AI_EMBEDDING_MODEL"),
  );
}

export function getChatModelId(providerMode: AiProviderMode) {
  if (providerMode === "company_hosted") {
    return requireModelEnv("COMPANY_AI_MODEL");
  }

  if (providerMode === "openai") {
    return requireModelEnv("OPENAI_MODEL");
  }

  if (providerMode === "anthropic") {
    return requireModelEnv("ANTHROPIC_MODEL");
  }

  return requireModelEnv("SELF_HOSTED_AI_MODEL");
}

export function getSmallChatModelId(providerMode: AiProviderMode) {
  const envName = smallModelEnvName(providerMode);
  const value = process.env[envName]?.trim();
  return value || null;
}

function requireModelEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ApiError(500, `${name} is not configured`);
  }

  return value;
}

function smallModelEnvName(providerMode: AiProviderMode) {
  if (providerMode === "company_hosted") {
    return "COMPANY_AI_SMALL_MODEL";
  }

  if (providerMode === "openai") {
    return "OPENAI_SMALL_MODEL";
  }

  if (providerMode === "anthropic") {
    return "ANTHROPIC_SMALL_MODEL";
  }

  return "SELF_HOSTED_AI_SMALL_MODEL";
}
