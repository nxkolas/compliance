import { chunkExtractedPages, createDocumentEmbeddingProvider, parseDocument } from "@/src/server/documents/domain";
import { MAX_LEGAL_SOURCE_BYTES } from "@/src/server/corpus/domain";
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
