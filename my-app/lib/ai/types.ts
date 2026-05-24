import type { UIMessage } from "ai";

export const aiProviderModes = [
  "company_hosted",
  "openai",
  "anthropic",
  "self_hosted",
] as const;

export type AiProviderMode = (typeof aiProviderModes)[number];

export const assistantModes = [
  "general_compliance_qa",
  "nis2_gap_analysis",
  "bsig_gap_analysis",
  "document_review",
  "policy_drafting",
  "evidence_mapping",
  "audit_preparation",
  "implementation_checklist",
] as const;

export type AssistantMode = (typeof assistantModes)[number];

export type AiCitation = {
  documentId: string;
  chunkId: string;
  title: string;
  scope: "organization" | "reference";
  sourceUrl?: string | null;
  storagePath?: string | null;
  excerpt: string;
};

export type AiAttachment = {
  documentId: string;
  title: string;
  status: "processing" | "ready" | "failed";
};

export type AiChatListItem = {
  id: string;
  title: string;
  assistantMode: AssistantMode;
  updatedAt: string;
};

export type ComplianceMessageMetadata = {
  attachments?: AiAttachment[];
  citations?: AiCitation[];
  prompt?: {
    name: string;
    version: string;
    hash: string;
    mode: AssistantMode;
  };
  validationWarnings?: string[];
};

export type ComplianceUIMessage = UIMessage<ComplianceMessageMetadata>;

export type RetrievedContextChunk = AiCitation & {
  content: string;
  similarity: number;
};

export type ComplianceAssistantOutput = {
  answerMarkdown: string;
  citations: AiCitation[];
  assumptions: string[];
  missingInformation: string[];
  recommendedActions: string[];
  confidence: "low" | "medium" | "high";
  legalDisclaimerRequired: boolean;
};
