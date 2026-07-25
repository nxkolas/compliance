import type { AiProviderMode } from "@/lib/ai/types";
import { aiProviderModes } from "@/lib/ai/types";
import { ApiError } from "../../api/errors";
import type { GroundedProvider } from "./types";

export const defaultOrganizationAiProviderPolicy = {
  allowedProviderModes: ["company_hosted", "self_hosted"] satisfies AiProviderMode[],
  externalDisclosureAllowed: false,
  retentionClassification: "internal_no_external_disclosure",
} as const;

export function selectGroundedProvider(input: {
  allowedModes: unknown;
  externalDisclosureAllowed: boolean;
  providers: Partial<Record<AiProviderMode, GroundedProvider>>;
  preferredMode?: string;
}) {
  const allowed = Array.isArray(input.allowedModes)
    ? input.allowedModes.filter((mode): mode is AiProviderMode => typeof mode === "string" && aiProviderModes.includes(mode as AiProviderMode))
    : [];
  const ordered = input.preferredMode && allowed.includes(input.preferredMode as AiProviderMode)
    ? [input.preferredMode as AiProviderMode, ...allowed.filter((mode) => mode !== input.preferredMode)]
    : allowed;
  for (const mode of ordered) {
    if (mode === "openai" && !input.externalDisclosureAllowed) continue;
    const provider = input.providers[mode];
    if (provider) return provider;
  }
  throw new ApiError(503, "No AI provider satisfies the effective disclosure policy", undefined, "AI_PROVIDER_POLICY_UNSATISFIED");
}
