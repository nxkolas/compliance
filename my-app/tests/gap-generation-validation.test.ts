import { describe, expect, it } from "vitest";
import {
  buildGapModelResponseSchema,
  deriveFindingSeverity,
  normalizeGroundedGapModelResponse,
  validateGapModelResponse,
  type SuppliedCitation,
} from "@/src/server/gap-analysis/generation-schema";

const citations: SuppliedCitation[] = [
  { id: "Q:a1", sourceType: "assessment_answer", sourceId: "a1", excerpt: "implemented", pageNumber: null, sectionLabel: null },
  { id: "DOC:c1", sourceType: "document_chunk", sourceId: "c1", excerpt: "quarterly review", pageNumber: 2, sectionLabel: "Access" },
];

function finding(overrides: Record<string, unknown> = {}) {
  return {
    requirementCode: "R1",
    status: "fulfilled",
    evidenceSufficiency: "sufficient",
    rationale: { de: "Begründung", en: "Rationale" },
    recommendation: { de: "Empfehlung", en: "Recommendation" },
    assumptions: [],
    citations: ["DOC:c1"],
    contradictions: [],
    requiresReview: false,
    ...overrides,
  };
}

describe("gap generation validation", () => {
  it("constrains structured output to every requested requirement", () => {
    const schema = buildGapModelResponseSchema(["R1", "R2"]);
    const payload: Record<string, unknown> = finding();
    delete payload.requirementCode;
    expect(() => schema.parse({ findings: { R1: payload } })).toThrow();
    expect(() => schema.parse({ findings: { R1: payload, R2: payload, R3: payload } })).toThrow();
    const parsed = schema.parse({ findings: { R1: payload, R2: payload } });
    expect(normalizeGroundedGapModelResponse(parsed).findings.map((item) => item.requirementCode))
      .toEqual(["R1", "R2"]);
  });

  it("accepts exact coverage and supplied immutable citations", () => {
    expect(
      validateGapModelResponse({
        value: { findings: [finding()] },
        requestedRequirementCodes: ["R1"],
        citations,
      }).findings,
    ).toHaveLength(1);
  });

  it("rejects partial output and invented citations", () => {
    expect(() =>
      validateGapModelResponse({
        value: { findings: [finding()] },
        requestedRequirementCodes: ["R1", "R2"],
        citations,
      }),
    ).toThrow(/cover every requested/i);
    expect(() =>
      validateGapModelResponse({
        value: { findings: [finding({ citations: ["DOC:invented"] })] },
        requestedRequirementCodes: ["R1"],
        citations,
      }),
    ).toThrow(/unknown citation/i);
  });

  it("prevents questionnaire-only fulfilled findings", () => {
    expect(() =>
      validateGapModelResponse({
        value: { findings: [finding({ citations: ["Q:a1"] })] },
        requestedRequirementCodes: ["R1"],
        citations,
      }),
    ).toThrow(/documentary evidence/i);
  });

  it("forces contradictions into review and derives severity without AI", () => {
    expect(() =>
      validateGapModelResponse({
        value: { findings: [finding({ contradictions: ["conflict"] })] },
        requestedRequirementCodes: ["R1"],
        citations,
      }),
    ).toThrow(/must require review/i);
    expect(deriveFindingSeverity("critical", "partially_fulfilled")).toBe("high");
    expect(deriveFindingSeverity("high", "not_fulfilled")).toBe("high");
  });
});
