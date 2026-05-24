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

function getChatModelId(providerMode: AiProviderMode) {
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

function requireModelEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ApiError(500, `${name} is not configured`);
  }

  return value;
}
