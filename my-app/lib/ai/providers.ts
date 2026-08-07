// Reads provider credentials from the environment. Importing this from a Client
// Component would put the OpenAI key's lookup on the wrong side of the
// boundary; `tests/client-server-boundary.test.ts` fails the build if one does.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { ApiError } from "@/src/server/api/errors";
import { aiProviderModes, type AiProviderMode } from "./types";

/**
 * Reads an env var as an optional configured value. Empty strings are treated as
 * missing so `.env` placeholders do not get passed into provider constructors.
 */
function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/**
 * Reads a required env var and raises a clear API error when it is missing.
 */
function requireEnv(name: string) {
  const value = optionalEnv(name);

  if (!value) {
    throw new ApiError(500, `${name} is not configured`);
  }

  return value;
}

/**
 * Validates provider base URLs before the AI SDK tries to build request URLs.
 */
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

/**
 * Provides the initial UI provider selection. This is only a UI default; the
 * chat API still requires the selected provider on every request.
 */
export function getDefaultAiProviderMode(): AiProviderMode {
  const configuredDefault = optionalEnv("AI_DEFAULT_PROVIDER");

  if (isAiProviderMode(configuredDefault)) {
    return configuredDefault;
  }

  return "openai";
}

/**
 * Creates the official OpenAI provider, used for OpenAI chat and embeddings.
 */
export function getOpenAIProvider() {
  return createOpenAI({
    apiKey: requireEnv("OPENAI_API_KEY"),
  });
}

/**
 * Creates an OpenAI-compatible provider for a customer/local inference service.
 */
export function getSelfHostedChatProvider() {
  return createOpenAICompatible({
    name: "self-hosted",
    baseURL: requireAbsoluteUrl("SELF_HOSTED_AI_BASE_URL"),
    apiKey: requireEnv("SELF_HOSTED_AI_API_KEY"),
    supportsStructuredOutputs: readBooleanEnvironment(
      "SELF_HOSTED_AI_SUPPORTS_STRUCTURED_OUTPUTS",
      false,
    ),
  });
}

/**
 * Runtime guard for `AI_DEFAULT_PROVIDER`, keeping env configuration aligned
 * with the provider mode union.
 */
function isAiProviderMode(value: unknown): value is AiProviderMode {
  return (
    typeof value === "string" &&
    aiProviderModes.includes(value as AiProviderMode)
  );
}

function readBooleanEnvironment(name: string, fallback: boolean) {
  const value = optionalEnv(name)?.toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}
