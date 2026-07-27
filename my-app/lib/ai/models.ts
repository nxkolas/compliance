import { ApiError } from "@/src/server/api/errors";
import {
  getCompanyHostedChatProvider,
  getOpenAIProvider,
  getSelfHostedChatProvider,
} from "./providers";
import type { AiProviderMode } from "./types";

/**
 * Resolves the selected provider and its configured chat model into an AI SDK
 * language model. This is the main model entrypoint used by `/api/chat`.
 */
export function getComplianceChatModel(providerMode: AiProviderMode) {
  const modelId = getChatModelId(providerMode);
  return getComplianceChatModelById(providerMode, modelId);
}

/**
 * Same as `getComplianceChatModel`, but lets callers pick an explicit model id.
 * The chat summarizer uses this for provider-specific "small model" settings.
 */
export function getComplianceChatModelById(
  providerMode: AiProviderMode,
  modelId: string,
) {
  if (providerMode === "openai") {
    return getOpenAIProvider()(modelId);
  }

  if (providerMode === "self_hosted") {
    return getSelfHostedChatProvider()(modelId);
  }

  return getCompanyHostedChatProvider()(modelId);
}

/**
 * Returns the embedding model tied to the selected provider. Chat and embedding
 * models are separate, but they must come from the same provider family.
 */
export function getComplianceEmbeddingModel(providerMode: AiProviderMode) {
  const modelId = getEmbeddingModelId(providerMode);
  if (providerMode === "openai") {
    return getOpenAIProvider().embeddingModel(modelId);
  }

  if (providerMode === "self_hosted") {
    return getSelfHostedChatProvider().embeddingModel(modelId);
  }

  return getCompanyHostedChatProvider().embeddingModel(modelId);
}

export function getEmbeddingModelId(providerMode: AiProviderMode) {
  if (providerMode === "openai") {
    return requireModelEnv("OPENAI_EMBEDDING_MODEL");
  }

  if (providerMode === "self_hosted") {
    return requireModelEnv("SELF_HOSTED_AI_EMBEDDING_MODEL");
  }

  return requireModelEnv("COMPANY_AI_EMBEDDING_MODEL");
}

/**
 * Reads the required chat model id for a provider. Missing values are hard
 * configuration errors because provider selection must never silently fall back.
 */
export function getChatModelId(providerMode: AiProviderMode) {
  if (providerMode === "company_hosted") {
    return requireModelEnv("COMPANY_AI_MODEL");
  }

  if (providerMode === "openai") {
    return requireModelEnv("OPENAI_MODEL");
  }

  return requireModelEnv("SELF_HOSTED_AI_MODEL");
}

/**
 * Reads an optional small-model id for background tasks like summarization.
 * Returning null lets chat continue if summarization is not configured.
 */
export function getSmallChatModelId(providerMode: AiProviderMode) {
  const envName = smallModelEnvName(providerMode);
  const value = process.env[envName]?.trim();
  return value || null;
}

/**
 * Reads a required model env var and turns a missing value into an API-safe
 * error message instead of a lower-level provider failure.
 */
function requireModelEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ApiError(500, `${name} is not configured`);
  }

  return value;
}

/**
 * Maps provider modes to the env var that may contain their cheaper/faster
 * summarization model.
 */
function smallModelEnvName(providerMode: AiProviderMode) {
  if (providerMode === "company_hosted") {
    return "COMPANY_AI_SMALL_MODEL";
  }

  if (providerMode === "openai") {
    return "OPENAI_SMALL_MODEL";
  }

  return "SELF_HOSTED_AI_SMALL_MODEL";
}
