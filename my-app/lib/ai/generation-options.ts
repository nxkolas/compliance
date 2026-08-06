import type { AiProviderMode } from "./types";
import { getModelCapabilityProfile } from "./model-capabilities";

export function getGenerationOptions(
  providerMode: AiProviderMode,
  options: { thinking?: boolean } = {},
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
            "self-hosted": {
              // Ollama only honours `reasoning_effort`. Without it Qwen3.5 spends
              // the entire output budget on reasoning tokens and returns empty
              // content, which surfaces as a terminal parse failure. This must
              // stay camelCase: the AI SDK maps `reasoningEffort` onto the wire
              // field itself, and a snake_case key would be overwritten by the
              // unset mapping rather than passed through.
              reasoningEffort: thinking ? "medium" : "none",
              // vLLM's equivalent, for self-hosted deployments that are not
              // Ollama. Each server ignores the key it does not recognise.
              extra_body: {
                chat_template_kwargs: {
                  enable_thinking: thinking,
                },
              },
            },
          },
        }
      : {}),
  };
}
