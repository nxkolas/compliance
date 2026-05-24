import type { AiProviderMode } from "@/lib/ai/types";

export type ModelCapabilityProfile = {
  supportsStreaming: boolean;
  supportsStructuredOutputs: boolean;
  supportsToolCalls: boolean;
  maxContextTokens: number;
  recommendedTemperature: number;
  citationReliability: "low" | "medium" | "high";
};

const defaults: Record<AiProviderMode, ModelCapabilityProfile> = {
  openai: {
    supportsStreaming: true,
    supportsStructuredOutputs: true,
    supportsToolCalls: true,
    maxContextTokens: 128000,
    recommendedTemperature: 0.2,
    citationReliability: "high",
  },
  anthropic: {
    supportsStreaming: true,
    supportsStructuredOutputs: false,
    supportsToolCalls: true,
    maxContextTokens: 200000,
    recommendedTemperature: 0.2,
    citationReliability: "high",
  },
  company_hosted: {
    supportsStreaming: true,
    supportsStructuredOutputs: false,
    supportsToolCalls: false,
    maxContextTokens: 32000,
    recommendedTemperature: 0.15,
    citationReliability: "medium",
  },
  self_hosted: {
    supportsStreaming: true,
    supportsStructuredOutputs: false,
    supportsToolCalls: false,
    maxContextTokens: 16000,
    recommendedTemperature: 0.1,
    citationReliability: "low",
  },
};

export function getModelCapabilityProfile(
  providerMode: AiProviderMode,
): ModelCapabilityProfile {
  const profile = defaults[providerMode];
  const prefix = providerEnvPrefix(providerMode);

  return {
    supportsStreaming: readBoolean(`${prefix}_SUPPORTS_STREAMING`, profile.supportsStreaming),
    supportsStructuredOutputs: readBoolean(
      `${prefix}_SUPPORTS_STRUCTURED_OUTPUTS`,
      profile.supportsStructuredOutputs,
    ),
    supportsToolCalls: readBoolean(
      `${prefix}_SUPPORTS_TOOL_CALLS`,
      profile.supportsToolCalls,
    ),
    maxContextTokens: readNumber(
      `${prefix}_MAX_CONTEXT_TOKENS`,
      profile.maxContextTokens,
    ),
    recommendedTemperature: readNumber(
      `${prefix}_RECOMMENDED_TEMPERATURE`,
      profile.recommendedTemperature,
    ),
    citationReliability: readCitationReliability(
      `${prefix}_CITATION_RELIABILITY`,
      profile.citationReliability,
    ),
  };
}

function providerEnvPrefix(providerMode: AiProviderMode) {
  if (providerMode === "company_hosted") {
    return "COMPANY_AI";
  }

  if (providerMode === "self_hosted") {
    return "SELF_HOSTED_AI";
  }

  return providerMode.toUpperCase();
}

function readBoolean(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function readCitationReliability(
  name: string,
  fallback: ModelCapabilityProfile["citationReliability"],
) {
  const value = process.env[name]?.trim();

  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return fallback;
}
