import { createHash } from "node:crypto";
import type { OrganizationDto } from "@/src/server/modules/organizations/types";
import type {
  AssistantMode,
  RetrievedContextChunk,
} from "@/src/server/platform/ai/types";
import type { ModelCapabilityProfile } from "@/src/server/platform/ai/model-capabilities";
import {
  renderComplianceSystemPrompt,
  renderComplianceSystemPromptTemplate,
} from "./compliance-system";
import { getPromptModeConfig } from "./prompt-modes";

export type BuiltCompliancePrompt = {
  system: string;
  promptTemplate: string;
  promptTemplateHash: string;
  promptName: string;
  promptVersion: string;
  promptHash: string;
  mode: AssistantMode;
  temperature: number;
  maxOutputTokens: number;
};

/**
 * Builds the complete system prompt and audit metadata for a chat request.
 * This is the single prompt assembly entrypoint used by the chat API.
 */
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
  const promptTemplate = renderComplianceSystemPromptTemplate({ modeConfig });
  const promptTemplateHash = createHash("sha256")
    .update(promptTemplate)
    .digest("hex");
  // Message rows keep the exact rendered prompt hash so audits can identify
  // which organization context and retrieved sources produced an answer.
  const promptHash = createHash("sha256").update(system).digest("hex");

  return {
    system,
    promptTemplate,
    promptTemplateHash,
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

/**
 * Caps retrieved chunks according to the current model profile so weaker/local
 * models receive less context and a simpler task.
 */
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
