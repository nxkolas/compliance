import type { AiProviderMode } from "./types";
import { getModelCapabilityProfile } from "./model-capabilities";

/**
 * How a self-hosted server is told not to think. See `generationThinkingStyles`
 * in the organization model settings service for why this matters.
 */
export type ThinkingStyle = "none" | "ollama" | "vllm";

export function getGenerationOptions(
  providerMode: AiProviderMode,
  options: { thinking?: boolean; thinkingStyle?: ThinkingStyle } = {},
) {
  const profile = getModelCapabilityProfile(providerMode);
  const thinking = options.thinking ?? false;

  return {
    ...(providerMode === "openai"
      ? {}
      : {
          temperature: thinking
            ? Math.max(profile.recommendedTemperature, 0.2)
            : profile.recommendedTemperature,
        }),
    ...(providerMode === "self_hosted"
      ? {
          providerOptions: {
            "self-hosted": thinkingControl(
              // Defaults to sending both switches. Each server ignores the key
              // it does not recognise, so this is correct for an unidentified
              // server and remains the behaviour for a deployment that has not
              // recorded which one it runs.
              options.thinkingStyle ?? "both",
              thinking,
            ),
          },
        }
      : {}),
  };
}

function thinkingControl(style: ThinkingStyle | "both", thinking: boolean) {
  // Ollama only honours `reasoning_effort`. Without it a thinking model spends
  // the entire output budget on reasoning tokens and returns empty content,
  // which surfaces as a terminal parse failure rather than a schema error --
  // so it gets no retry and no repair pass.
  //
  // This must stay camelCase: the AI SDK maps `reasoningEffort` onto the wire
  // field itself, and a snake_case key would be overwritten by the unset
  // mapping rather than passed through.
  const ollama = { reasoningEffort: thinking ? "medium" : "none" };
  // vLLM's equivalent.
  const vllm = {
    extra_body: { chat_template_kwargs: { enable_thinking: thinking } },
  };

  if (style === "ollama") return ollama;
  if (style === "vllm") return vllm;
  if (style === "none") return {};
  return { ...ollama, ...vllm };
}
