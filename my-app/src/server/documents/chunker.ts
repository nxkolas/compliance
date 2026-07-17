import type { ExtractedPage } from "./parser";

export type DocumentChunkInput = {
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  sectionLabel: string | null;
  tokenCount: number;
};

const MAX_CHARS = 1_200;
const OVERLAP_CHARS = 180;

export function chunkExtractedPages(pages: ExtractedPage[]): DocumentChunkInput[] {
  const chunks: DocumentChunkInput[] = [];
  for (const page of pages) {
    const sections = splitSections(page.text);
    for (const section of sections) {
      for (const content of splitWithOverlap(section.content)) {
        if (!content.trim()) continue;
        chunks.push({
          chunkIndex: chunks.length,
          content,
          pageNumber: page.pageNumber,
          sectionLabel: section.label,
          tokenCount: estimateTokens(content),
        });
      }
    }
  }
  return chunks;
}

function splitSections(text: string) {
  const lines = text.split("\n");
  const sections: Array<{ label: string | null; content: string }> = [];
  let label: string | null = null;
  let body: string[] = [];
  const flush = () => {
    const content = body.join("\n").trim();
    if (content) sections.push({ label, content });
    body = [];
  };
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flush();
      label = heading[1].trim();
    } else {
      body.push(line);
    }
  }
  flush();
  return sections.length ? sections : [{ label: null, content: text.trim() }];
}

function splitWithOverlap(text: string) {
  if (text.length <= MAX_CHARS) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_CHARS, text.length);
    if (end < text.length) {
      const paragraph = text.lastIndexOf("\n\n", end);
      const sentence = text.lastIndexOf(". ", end);
      const boundary = Math.max(paragraph, sentence);
      if (boundary > start + MAX_CHARS / 2) end = boundary + 1;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(start + 1, end - OVERLAP_CHARS);
  }
  return chunks;
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
