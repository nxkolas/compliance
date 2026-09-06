import type { AssistantMode, RetrievedContextChunk } from "@/src/server/platform/ai/types";
import { getPromptModeConfig } from "./prompt-modes";

export type CitationPolicy = {
  requiresCuratedCitation: boolean;
  requiresUploadedCitation: boolean;
  noSourceInstruction: string;
};

/**
 * Converts a mode's citation settings into prompt instructions and validator
 * expectations.
 */
export function getCitationPolicy(mode: AssistantMode): CitationPolicy {
  const config = getPromptModeConfig(mode);

  return {
    requiresCuratedCitation: config.requiresCuratedCitation,
    requiresUploadedCitation: config.requiresUploadedCitation,
    noSourceInstruction:
      "If there is not enough sourced information, say exactly that and ask for the missing document or legal reference. Do not invent citations.",
  };
}

/**
 * Checks whether retrieval included at least one source from a given scope.
 */
export function contextHasScope(
  context: RetrievedContextChunk[],
  scope: "reference" | "organization",
) {
  return context.some((chunk) => chunk.scope === scope);
}

/**
 * Creates prompt-local source IDs from retrieved chunks.
 */
export function sourceIdsForContext(context: RetrievedContextChunk[]) {
  return context.map((chunk, index) => ({
    sourceId: `S${index + 1}`,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    scope: chunk.scope,
    title: chunk.title,
  }));
}
