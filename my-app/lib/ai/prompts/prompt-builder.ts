import { createHash } from "node:crypto";
import type { OrganizationDto } from "@/src/server/organizations/types";
import type {
  AssistantMode,
  RetrievedContextChunk,
} from "@/lib/ai/types";
import type { ModelCapabilityProfile } from "@/lib/ai/model-capabilities";
import { renderComplianceSystemPrompt } from "./compliance-system";
import { getPromptModeConfig } from "./prompt-modes";

export type BuiltCompliancePrompt = {
  system: string;
  promptName: string;
  promptVersion: string;
  promptHash: string;
  mode: AssistantMode;
  temperature: number;
  maxOutputTokens: number;
};

export function buildCompliancePrompt({
  mode,
  organization,
  retrievedChunks,
  chatSummary,
  locale,
  modelCapabilities,
}: {
  mode: AssistantMode;
  organization: OrganizationDto;
  retrievedChunks: RetrievedContextChunk[];
  chatSummary?: string | null;
  locale: string;
  modelCapabilities: ModelCapabilityProfile;
}): BuiltCompliancePrompt {
  const modeConfig = getPromptModeConfig(mode);
  const system = renderComplianceSystemPrompt({
    organization,
    retrievedContext: limitChunksForModel(
      retrievedChunks,
      modelCapabilities.maxContextTokens,
    ),
    chatSummary,
    modeConfig,
    locale,
    modelCapabilities,
  });
  const promptHash = createHash("sha256").update(system).digest("hex");

  return {
    system,
    promptName: modeConfig.promptName,
    promptVersion: modeConfig.promptVersion,
    promptHash,
    mode,
    temperature: Math.min(
      modeConfig.temperature,
      modelCapabilities.recommendedTemperature,
    ),
    maxOutputTokens: modeConfig.maxOutputTokens,
  };
}

function limitChunksForModel(
  chunks: RetrievedContextChunk[],
  maxContextTokens: number,
) {
  if (maxContextTokens >= 64000) {
    return chunks.slice(0, 10);
  }

  if (maxContextTokens >= 32000) {
    return chunks.slice(0, 6);
  }

  return chunks.slice(0, 4);
}
