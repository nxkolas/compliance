import { chunkExtractedPages } from "./chunker";
import type { ContentChunker } from "./types";

export const paragraphContentChunker: ContentChunker = {
  chunk: chunkExtractedPages,
};
