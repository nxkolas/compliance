import type { UIMessage } from "ai";

export const aiProviderModes = [
  "company_hosted",
  "openai",
  "anthropic",
  "self_hosted",
] as const;

export type AiProviderMode = (typeof aiProviderModes)[number];

export type AiCitation = {
  documentId: string;
  chunkId: string;
  title: string;
  scope: "organization" | "reference";
  sourceUrl?: string | null;
  storagePath?: string | null;
  excerpt: string;
};

export type ComplianceMessageMetadata = {
  citations?: AiCitation[];
};

export type ComplianceUIMessage = UIMessage<ComplianceMessageMetadata>;

export type RetrievedContextChunk = AiCitation & {
  content: string;
  similarity: number;
};
