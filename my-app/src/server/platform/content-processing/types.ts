import type { DocumentChunkInput } from "./chunker";
import type { ParsedDocument } from "./parser";

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
  key: string;
  embed(values: string[], purpose?: "document" | "query"): Promise<number[][]>;
};

export type EmbeddingConfiguration = Omit<ContentEmbedder, "embed">;

