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
  dimensions: number;
  embed(values: string[]): Promise<number[][]>;
};
