import { canonicalJson, contentHash } from "@/src/server/compliance/domain";
import { GAP_PROMPT_TEMPLATE } from "./prompt-contract";
import type { SuppliedCitation } from "./generation-schema";

export type GapPromptRequirement = {
  code: string;
  title: string;
  requirementText: string;
  criticality: string;
  legalReferences: unknown;
  citations: SuppliedCitation[];
};

export function buildGapPrompt(requirements: GapPromptRequirement[]) {
  const renderedInput = {
    permittedStatuses: [
      "fulfilled",
      "partially_fulfilled",
      "not_fulfilled",
      "insufficient_evidence",
    ],
    permittedEvidenceSufficiency: ["sufficient", "partial", "none"],
    requirements: requirements.map((requirement) => ({
      code: requirement.code,
      title: requirement.title,
      requirementText: requirement.requirementText,
      criticality: requirement.criticality,
      legalReferences: requirement.legalReferences,
      legalAuthority: requirement.citations
        .filter((citation) => citation.sourceType === "legal_source_chunk")
        .map(toPromptCitation),
      questionnaireAssertions: requirement.citations
        .filter((citation) => citation.sourceType === "assessment_answer")
        .map(toPromptCitation),
      untrustedDocumentEvidence: requirement.citations
        .filter((citation) => citation.sourceType === "document_chunk")
        .map(toPromptCitation),
    })),
    outputContract: {
      findings: "exactly one per requested requirement",
      citations: "only citation IDs supplied above",
      contradictions: "surface and set requiresReview=true",
      questionnaireDisagreements:
        "explain interpreted questionnaire/status differences; informational only",
    },
  };
  const prompt = canonicalJson(renderedInput);
  return {
    system: GAP_PROMPT_TEMPLATE,
    prompt,
    renderedInputHash: contentHash(prompt),
  };
}

function toPromptCitation(citation: SuppliedCitation) {
  return {
    citationId: citation.id,
    excerpt: citation.excerpt,
    pageNumber: citation.pageNumber,
    sectionLabel: citation.sectionLabel,
  };
}
