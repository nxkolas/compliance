import type { AiCitation, ComplianceAssistantOutput } from "@/lib/ai/types";

/**
 * Prompt text that asks the model for a stable Markdown shape while still
 * allowing streamed user-facing answers.
 */
export const outputContractInstruction = [
  "Use this answer structure:",
  "1. Start with the answer in Markdown.",
  "2. Cite retrieved sources inline as [S1], [S2], etc. when making sourced claims.",
  "3. Include short sections named Assumptions, Missing information, Recommended actions, and Confidence when relevant.",
  "4. Do not output raw JSON to the user unless explicitly asked.",
].join("\n");

/**
 * Builds the structured record persisted after streaming finishes.
 */
export function buildAssistantOutputContract({
  answerMarkdown,
  citations,
  assumptions = [],
  missingInformation = [],
  recommendedActions = [],
  confidence = "medium",
  legalDisclaimerRequired = true,
}: {
  answerMarkdown: string;
  citations: AiCitation[];
  assumptions?: string[];
  missingInformation?: string[];
  recommendedActions?: string[];
  confidence?: ComplianceAssistantOutput["confidence"];
  legalDisclaimerRequired?: boolean;
}): ComplianceAssistantOutput {
  return {
    answerMarkdown,
    citations,
    assumptions,
    missingInformation,
    recommendedActions,
    confidence,
    legalDisclaimerRequired,
  };
}
