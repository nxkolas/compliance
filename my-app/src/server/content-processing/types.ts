import type { DocumentChunkInput, ParsedDocument } from "@/src/server/documents/domain";

export type ContentParser = {
  parse(bytes: Uint8Array, mimeType: string): Promise<ParsedDocument>;
};

export type ContentChunker = {
  chunk(pages: ParsedDocument["pages"]): DocumentChunkInput[];
};

export type ContentEmbedder = {
  provider: string;
  model: string;
  modelRevision: string;
  dimensions: number;
  retrievalInstructionId: string;
  chunkingVersion: string;
  /** Identity of the vector space; see `embeddingIdentityKey`. */
  key: string;
  embed(
    values: string[],
    purpose?: "document" | "query",
  ): Promise<number[][]>;
};
