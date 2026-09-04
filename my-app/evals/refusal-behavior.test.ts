import { describe, expect, it } from "vitest";
import { validateComplianceResponse } from "../src/server/modules/grounding/prompts/response-validator";

describe("refusal and uncertainty behavior", () => {
  it("flags no-context answers that do not state insufficient sourced information", () => {
    const result = validateComplianceResponse({
      answerMarkdown: "You are definitely compliant with NIS2.",
      citations: [],
      retrievedContext: [],
      mode: "nis2_gap_analysis",
    });

    expect(result.warnings.some((warning) => warning.includes("No RAG context"))).toBe(
      true,
    );
  });

  it("does not flag explicit insufficient-information language", () => {
    const result = validateComplianceResponse({
      answerMarkdown: "There is not enough sourced information to decide.",
      citations: [],
      retrievedContext: [],
      mode: "general_compliance_qa",
    });

    expect(result.warnings.some((warning) => warning.includes("No RAG context"))).toBe(
      false,
    );
  });
});
