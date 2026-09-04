import type { AiProviderMode } from "@/src/server/platform/ai/types";
import { ApiError } from "../../platform/http/errors";
import type { GroundedProvider } from "./types";

export function selectGroundedProvider(input: {
  selectedMode: AiProviderMode;
  providers: Partial<Record<AiProviderMode, GroundedProvider>>;
}) {
  const provider = input.providers[input.selectedMode];
  if (provider) return provider;
  throw new ApiError(
    503,
    `The selected AI provider ${input.selectedMode} is unavailable`,
    undefined,
    "AI_PROVIDER_UNAVAILABLE",
  );
}
