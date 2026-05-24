import { customProvider } from "ai";
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

const fallbackModels: Record<AiProviderMode, string> = {
  company_hosted: "compliance-model",
  openai: "gpt-4.1",
  anthropic: "claude-sonnet-4-5",
  self_hosted: "compliance-model",
};

export function getComplianceChatModel(
  providerMode: AiProviderMode = "company_hosted",
) {
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
    return process.env.COMPANY_AI_MODEL ?? getChatModelName();
  }

  const envPrefix = providerModeEnvPrefix(providerMode);
  const envValue = process.env[`${envPrefix}_MODEL`];

  return envValue ?? fallbackModels[providerMode];
}

function providerModeEnvPrefix(providerMode: Exclude<AiProviderMode, "company_hosted">) {
  if (providerMode === "openai") {
    return "OPENAI";
  }

  if (providerMode === "anthropic") {
    return "ANTHROPIC";
  }

  return "SELF_HOSTED_AI";
}
