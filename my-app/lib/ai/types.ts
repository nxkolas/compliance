import type { UIMessage } from "ai";

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
