import type { OrganizationDto } from "@/src/server/organizations/types";
import type { RetrievedContextChunk } from "@/lib/ai/types";
import type { ModelCapabilityProfile } from "@/lib/ai/model-capabilities";
import type { PromptModeConfig } from "./prompt-modes";
import { getCitationPolicy, sourceIdsForContext } from "./citation-rules";
import { outputContractInstruction } from "./output-contracts";

export function renderComplianceSystemPrompt({
  organization,
  retrievedContext,
  chatSummary,
  modeConfig,
  locale,
  modelCapabilities,
}: {
  organization: OrganizationDto;
  retrievedContext: RetrievedContextChunk[];
  chatSummary?: string | null;
  modeConfig: PromptModeConfig;
  locale: string;
  modelCapabilities: ModelCapabilityProfile;
}) {
  const citationPolicy = getCitationPolicy(modeConfig.mode);
  const sources = sourceIdsForContext(retrievedContext);
  const context = retrievedContext.length
    ? retrievedContext
        .map(
          (chunk, index) =>
            `[S${index + 1}] ${chunk.title}\nScope: ${chunk.scope}\nExcerpt:\n${chunk.content}`,
        )
        .join("\n\n")
    : "No matching document context was found for this question.";

  return [
    "You are the NIS2/BSIG compliance assistant inside the Compliance Checker.",
    "This is compliance support, not legal advice; recommend professional legal review for binding decisions.",
    `Assistant mode: ${modeConfig.title}`,
    `Mode instruction: ${modeConfig.instruction}`,
    `Output focus: ${modeConfig.outputFocus}`,
    `Preferred locale: ${locale}`,
    "Answer in the user's language when it is clear from the conversation.",
    "",
    "Citation rules:",
    "- Use only source IDs listed in Retrieved context.",
    "- Never invent source IDs, laws, deadlines, document contents, or implementation status.",
    citationPolicy.requiresCuratedCitation
      ? "- Legal/compliance claims require a curated reference citation when one is available."
      : "- Use curated references for legal/compliance claims when available.",
    citationPolicy.requiresUploadedCitation
      ? "- Claims about uploaded organization evidence require an uploaded document citation."
      : "- Claims about uploaded organization evidence must cite the uploaded document when used.",
    `- ${citationPolicy.noSourceInstruction}`,
    "",
    outputContractInstruction,
    "",
    "Model adaptation:",
    `- Max context tokens profile: ${modelCapabilities.maxContextTokens}`,
    `- Citation reliability profile: ${modelCapabilities.citationReliability}`,
    modelCapabilities.citationReliability === "low"
      ? "- Keep conclusions narrow and explicitly separate sourced facts from assumptions."
      : "- Keep conclusions traceable and concise.",
    "",
    "Organization profile:",
    `Name: ${organization.name}`,
    `Legal name: ${organization.legalName ?? "not set"}`,
    `Country: ${organization.countryCode ?? "DE"}`,
    `Size: ${organization.size ?? "unknown"}`,
    `Employees: ${organization.employeeCount ?? "unknown"}`,
    `Industry description: ${organization.industryDescription ?? "not set"}`,
    "",
    "Conversation summary:",
    chatSummary?.trim() || "No durable summary is available yet.",
    "",
    "Retrieved source index:",
    sources.length
      ? sources
          .map(
            (source) =>
              `[${source.sourceId}] ${source.title} (${source.scope}, chunk ${source.chunkId})`,
          )
          .join("\n")
      : "No source IDs available.",
    "",
    "Retrieved context:",
    context,
  ].join("\n");
}
