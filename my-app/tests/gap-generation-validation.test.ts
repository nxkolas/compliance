import { describe, expect, it } from "vitest";
import {
  buildGapModelResponseSchema,
  deriveFindingSeverity,
  extractGapGeneratedProse,
  normalizeGroundedGapModelResponse,
  validateGapModelResponse,
  type SuppliedCitation,
} from "@/src/server/gap-analysis/generation-schema";
import { gapOutputLocaleInstruction } from "@/src/server/gap-analysis/grounding-instruction";

const citations: SuppliedCitation[] = [
  { id: "Q:a1", sourceType: "assessment_answer", sourceId: "a1", excerpt: "implemented", pageNumber: null, sectionLabel: null },
  { id: "DOC:c1", sourceType: "document_chunk", sourceId: "c1", excerpt: "quarterly review", pageNumber: 2, sectionLabel: "Access" },
];

function finding(overrides: Record<string, unknown> = {}) {
  return {
    requirementCode: "R1",
    status: "fulfilled",
    evidenceSufficiency: "sufficient",
    rationale: "Begründung",
    recommendation: "Empfehlung",
    assumptions: [],
    citations: ["DOC:c1"],
    contradictions: [],
    questionnaireDisagreements: [],
    requiresReview: false,
    ...overrides,
  };
}

describe("gap generation validation", () => {
  it("instructs grounded free text to follow the active UI language", () => {
    expect(gapOutputLocaleInstruction("de")).toContain("in German");
    expect(gapOutputLocaleInstruction("en")).toContain("in English");
    expect(gapOutputLocaleInstruction("de")).toContain(
      "questionnaireDisagreements",
    );
    expect(gapOutputLocaleInstruction("de")).toContain("rationale");
    expect(gapOutputLocaleInstruction("de")).toContain("recommendation");
    expect(gapOutputLocaleInstruction("de")).not.toContain(
      "populate both de and en",
    );
  });

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

  it("extracts generated prose without evidence or citation identifiers", () => {
    const payload: Record<string, unknown> = finding({
      assumptions: ["Annahme"],
      contradictions: ["Widerspruch"],
      questionnaireDisagreements: ["Abweichung"],
    });
    delete payload.requirementCode;
    expect(
      extractGapGeneratedProse({
        findings: {
          R1: payload as never,
        },
      }),
    ).toEqual([
      "Begründung",
      "Empfehlung",
      "Annahme",
      "Widerspruch",
      "Abweichung",
    ]);
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

  it("accepts a questionnaire-only fulfilled finding independently of document support", () => {
    expect(
      validateGapModelResponse({
        value: {
          findings: [
            finding({
              citations: ["Q:a1"],
              evidenceSufficiency: "none",
            }),
          ],
        },
        requestedRequirementCodes: ["R1"],
        citations,
      }).findings[0],
    ).toMatchObject({
      status: "fulfilled",
      evidenceSufficiency: "none",
      citations: ["Q:a1"],
    });
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

  it("keeps questionnaire disagreements informational", () => {
    expect(
      validateGapModelResponse({
        value: {
          findings: [
            finding({
              questionnaireDisagreements: [
                "The assertion covers policy text but not operational testing.",
              ],
              requiresReview: false,
            }),
          ],
        },
        requestedRequirementCodes: ["R1"],
        citations,
      }).findings[0],
    ).toMatchObject({
      requiresReview: false,
      questionnaireDisagreements: [expect.any(String)],
    });
  });
});
