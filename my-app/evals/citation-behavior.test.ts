import { describe, expect, it } from "vitest";
import { validateComplianceResponse } from "../src/server/modules/grounding/prompts/response-validator";
import type { RetrievedContextChunk } from "../src/server/platform/ai/types";

const referenceChunk: RetrievedContextChunk = {
  documentId: "doc-1",
  chunkId: "chunk-1",
  title: "NIS2 reference",
  scope: "reference",
  sourceUrl: "https://example.com",
  storagePath: null,
  excerpt: "reference excerpt",
  content: "reference content",
  similarity: 0.9,
};

describe("citation validator", () => {
  it("accepts available source IDs", () => {
    const result = validateComplianceResponse({
      answerMarkdown: "NIS2 requires risk management measures [S1].",
      citations: [],
      retrievedContext: [referenceChunk],
      mode: "nis2_gap_analysis",
    });

    expect(result.warnings).not.toContain("Invented or unavailable citation S1");
  });

  it("flags invented source IDs", () => {
    const result = validateComplianceResponse({
      answerMarkdown: "NIS2 requires risk management measures [S9].",
      citations: [],
      retrievedContext: [referenceChunk],
      mode: "nis2_gap_analysis",
    });

    expect(result.warnings).toContain("Invented or unavailable citation S9");
  });
});
