import type { AssistantMode } from "@/lib/ai/types";

export type CitationStrictness = "standard" | "strict" | "document";

export type PromptModeConfig = {
  mode: AssistantMode;
  promptName: string;
  promptVersion: string;
  title: string;
  instruction: string;
  outputFocus: string;
  citationStrictness: CitationStrictness;
  requiresCuratedCitation: boolean;
  requiresUploadedCitation: boolean;
  legalDisclaimerRequired: boolean;
  temperature: number;
  maxOutputTokens: number;
};

/**
 * Declarative prompt settings per assistant mode. The prompt builder and
 * validator both read from this registry so behavior stays consistent.
 */
export const promptModeConfigs: Record<AssistantMode, PromptModeConfig> = {
  general_compliance_qa: {
    mode: "general_compliance_qa",
    promptName: "general_compliance_qa",
    promptVersion: "2026-05-24",
    title: "General compliance Q&A",
    instruction:
      "Answer practical NIS2/BSIG compliance questions. Keep answers concise, sourced, and explicit about uncertainty.",
    outputFocus: "direct answer, caveats, recommended next step",
    citationStrictness: "standard",
    requiresCuratedCitation: false,
    requiresUploadedCitation: false,
    legalDisclaimerRequired: true,
    temperature: 0.2,
    maxOutputTokens: 1200,
  },
  nis2_gap_analysis: {
    mode: "nis2_gap_analysis",
    promptName: "nis2_gap_analysis",
    promptVersion: "2026-05-24",
    title: "NIS2 gap analysis",
    instruction:
      "Assess gaps against NIS2-oriented obligations. Separate observed evidence, likely gaps, missing information, and actions.",
    outputFocus: "gap table, evidence, missing information, actions",
    citationStrictness: "strict",
    requiresCuratedCitation: true,
    requiresUploadedCitation: false,
    legalDisclaimerRequired: true,
    temperature: 0.1,
    maxOutputTokens: 1800,
  },
  bsig_gap_analysis: {
    mode: "bsig_gap_analysis",
    promptName: "bsig_gap_analysis",
    promptVersion: "2026-05-24",
    title: "BSIG gap analysis",
    instruction:
      "Assess gaps against German BSIG-oriented requirements. Distinguish legal basis, organization evidence, assumptions, and remediation.",
    outputFocus: "BSIG gap table, source basis, evidence, remediation",
    citationStrictness: "strict",
    requiresCuratedCitation: true,
    requiresUploadedCitation: false,
    legalDisclaimerRequired: true,
    temperature: 0.1,
    maxOutputTokens: 1800,
  },
  document_review: {
    mode: "document_review",
    promptName: "document_review",
    promptVersion: "2026-05-24",
    title: "Document review",
    instruction:
      "Review uploaded documents for compliance relevance. Only make document-specific claims when supported by uploaded document excerpts.",
    outputFocus: "document findings, risks, missing sections, suggested edits",
    citationStrictness: "document",
    requiresCuratedCitation: false,
    requiresUploadedCitation: true,
    legalDisclaimerRequired: true,
    temperature: 0.15,
    maxOutputTokens: 1600,
  },
  policy_drafting: {
    mode: "policy_drafting",
    promptName: "policy_drafting",
    promptVersion: "2026-05-24",
    title: "Policy drafting",
    instruction:
      "Draft compliance policy language. Clearly label draft text and list assumptions that must be checked before use.",
    outputFocus: "draft policy text, assumptions, review checklist",
    citationStrictness: "standard",
    requiresCuratedCitation: true,
    requiresUploadedCitation: false,
    legalDisclaimerRequired: true,
    temperature: 0.25,
    maxOutputTokens: 2200,
  },
  evidence_mapping: {
    mode: "evidence_mapping",
    promptName: "evidence_mapping",
    promptVersion: "2026-05-24",
    title: "Evidence mapping",
    instruction:
      "Map uploaded evidence to compliance requirements. Avoid marking implementation as complete unless the evidence directly supports it.",
    outputFocus: "requirement, evidence, status, missing evidence, action",
    citationStrictness: "document",
    requiresCuratedCitation: true,
    requiresUploadedCitation: true,
    legalDisclaimerRequired: true,
    temperature: 0.1,
    maxOutputTokens: 1800,
  },
  audit_preparation: {
    mode: "audit_preparation",
    promptName: "audit_preparation",
    promptVersion: "2026-05-24",
    title: "Audit preparation",
    instruction:
      "Prepare audit-facing summaries, evidence requests, and interview questions. Keep claims traceable to sources.",
    outputFocus: "audit checklist, evidence requests, interview questions",
    citationStrictness: "strict",
    requiresCuratedCitation: true,
    requiresUploadedCitation: false,
    legalDisclaimerRequired: true,
    temperature: 0.15,
    maxOutputTokens: 1800,
  },
  implementation_checklist: {
    mode: "implementation_checklist",
    promptName: "implementation_checklist",
    promptVersion: "2026-05-24",
    title: "Implementation checklist",
    instruction:
      "Turn compliance requirements and evidence gaps into implementable tasks. Include owners or sequencing only when the user supplied enough context.",
    outputFocus: "prioritized tasks, dependencies, evidence to collect",
    citationStrictness: "standard",
    requiresCuratedCitation: true,
    requiresUploadedCitation: false,
    legalDisclaimerRequired: true,
    temperature: 0.2,
    maxOutputTokens: 1800,
  },
};

/**
 * Returns the mode configuration used for prompt construction and validation.
 */
export function getPromptModeConfig(mode: AssistantMode) {
  return promptModeConfigs[mode];
}
