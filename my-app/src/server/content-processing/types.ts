import type { ParsedDocument } from "../documents/parser";
import type { DocumentChunkInput } from "../documents/chunker";

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
