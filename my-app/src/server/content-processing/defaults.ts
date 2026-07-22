import { chunkExtractedPages } from "../documents/chunker";
import { createDocumentEmbeddingProvider } from "../documents/embeddings";
import { parseDocument } from "../documents/parser";
import { MAX_LEGAL_SOURCE_BYTES } from "../corpus/config";
import type { ContentChunker, ContentEmbedder, ContentParser } from "./types";

export const legalContentParser: ContentParser = {
  parse(bytes, mimeType) {
    return parseDocument(bytes, mimeType, { maxBytes: MAX_LEGAL_SOURCE_BYTES });
  },
};

export const paragraphContentChunker: ContentChunker = {
  chunk: chunkExtractedPages,
};

export function createContentEmbedder(): ContentEmbedder {
  return createDocumentEmbeddingProvider();
}
