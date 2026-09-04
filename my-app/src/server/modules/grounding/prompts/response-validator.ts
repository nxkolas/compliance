import type {
  AiCitation,
  AssistantMode,
  ComplianceAssistantOutput,
  RetrievedContextChunk,
} from "@/src/server/platform/ai/types";
import { buildAssistantOutputContract } from "./output-contracts";
import { contextHasScope } from "./citation-rules";
import { getPromptModeConfig } from "./prompt-modes";

export type ResponseValidationResult = {
  output: ComplianceAssistantOutput;
  warnings: string[];
  generatedCitationIds: string[];
};

/**
 * Performs post-generation checks that the model cannot be trusted to enforce
 * by itself: citation IDs, required source types, and no-context uncertainty.
 */
export function validateComplianceResponse({
  answerMarkdown,
  citations,
  retrievedContext,
  mode,
}: {
  answerMarkdown: string;
  citations: AiCitation[];
  retrievedContext: RetrievedContextChunk[];
  mode: AssistantMode;
}): ResponseValidationResult {
  const warnings: string[] = [];
  const config = getPromptModeConfig(mode);
  const generatedCitationIds = extractSourceIds(answerMarkdown);
  // Source IDs are prompt-local (`S1`, `S2`, ...), so validate against the
  // retrieved chunk order used in the prompt rather than database IDs.
  const validSourceIds = new Set(
    retrievedContext.map((_, index) => `S${index + 1}`),
  );

  for (const sourceId of generatedCitationIds) {
    if (!validSourceIds.has(sourceId)) {
      warnings.push(`Invented or unavailable citation ${sourceId}`);
    }
  }

  if (config.requiresCuratedCitation && !contextHasScope(retrievedContext, "reference")) {
    warnings.push("Mode requires curated reference context, but none was retrieved.");
  }

  if (
    config.requiresUploadedCitation &&
    !contextHasScope(retrievedContext, "organization")
  ) {
    warnings.push("Mode requires uploaded document context, but none was retrieved.");
  }

  if (retrievedContext.length === 0 && !mentionsInsufficientInformation(answerMarkdown)) {
    warnings.push("No RAG context was retrieved, but answer did not clearly state insufficient sourced information.");
  }

  if (
    looksLikeComplianceClaim(answerMarkdown) &&
    citations.length === 0 &&
    generatedCitationIds.length === 0
  ) {
    warnings.push("Compliance/legal answer contains no citations.");
  }

  const output = buildAssistantOutputContract({
    answerMarkdown,
    citations,
    missingInformation:
      warnings.length > 0
        ? ["Review validation warnings before relying on this answer."]
        : [],
    confidence: warnings.length > 0 ? "low" : "medium",
    legalDisclaimerRequired: config.legalDisclaimerRequired,
  });

  return {
    output,
    warnings,
    generatedCitationIds,
  };
}

/**
 * Finds inline source markers like `[S1]` in the generated Markdown answer.
 */
function extractSourceIds(value: string) {
  return Array.from(value.matchAll(/\[(S\d+)\]/g)).map((match) => match[1]);
}

/**
 * Detects whether the answer openly admits that source context is insufficient.
 */
function mentionsInsufficientInformation(value: string) {
  return /not enough|insufficient|nicht genug|nicht ausreichend|fehlende|missing/i.test(
    value,
  );
}

/**
 * Lightweight heuristic used to decide when citation absence is suspicious.
 */
function looksLikeComplianceClaim(value: string) {
  return /nis2|bsig|pflicht|requirement|obligation|compliance|legal|gesetz|regulation|audit/i.test(
    value,
  );
}
