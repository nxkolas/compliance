import type { AssistantMode, RetrievedContextChunk } from "@/lib/ai/types";
import { getPromptModeConfig } from "./prompt-modes";

export type CitationPolicy = {
  requiresCuratedCitation: boolean;
  requiresUploadedCitation: boolean;
  noSourceInstruction: string;
};

export function getCitationPolicy(mode: AssistantMode): CitationPolicy {
  const config = getPromptModeConfig(mode);

  return {
    requiresCuratedCitation: config.requiresCuratedCitation,
    requiresUploadedCitation: config.requiresUploadedCitation,
    noSourceInstruction:
      "If there is not enough sourced information, say exactly that and ask for the missing document or legal reference. Do not invent citations.",
  };
}

export function contextHasScope(
  context: RetrievedContextChunk[],
  scope: "reference" | "organization",
) {
  return context.some((chunk) => chunk.scope === scope);
}

export function sourceIdsForContext(context: RetrievedContextChunk[]) {
  return context.map((chunk, index) => ({
    sourceId: `S${index + 1}`,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    scope: chunk.scope,
    title: chunk.title,
  }));
}
