import type { AiProviderMode } from "./types";
import { getModelCapabilityProfile } from "./model-capabilities";

export function getGenerationOptions(
  providerMode: AiProviderMode,
  options: { thinking?: boolean } = {},
) {
  const profile = getModelCapabilityProfile(providerMode);
  const thinking = options.thinking ?? false;

  return {
    temperature: thinking
      ? Math.max(profile.recommendedTemperature, 0.2)
      : profile.recommendedTemperature,
    ...(providerMode === "self_hosted"
      ? {
          providerOptions: {
            "self-hosted": {
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
