import { customProvider } from "ai";
import { ApiError } from "@/src/server/api/errors";
import {
  getChatModelName,
  getAnthropicProvider,
  getCompanyHostedChatProvider,
  getEmbeddingModelName,
  getEmbeddingProvider,
  getOpenAIProvider,
  getSmallChatModelName,
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

export function getComplianceTitleModel() {
  return getCompanyHostedChatProvider()(getSmallChatModelName());
}

export function getComplianceEmbeddingModel() {
  return getEmbeddingProvider().embeddingModel(getEmbeddingModelName());
}

export function getComplianceProvider() {
  const chatProvider = getCompanyHostedChatProvider();

  return customProvider({
    languageModels: {
      "chat-model": chatProvider(getChatModelName()),
      "title-model": chatProvider(getSmallChatModelName()),
      "artifact-model": chatProvider(getChatModelName()),
    },
  });
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
