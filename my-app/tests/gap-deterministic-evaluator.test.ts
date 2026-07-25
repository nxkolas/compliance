import { describe, expect, it } from "vitest";
import {
  evaluateGapCategory,
  evaluateGapRequirement,
} from "@/src/server/gap-analysis/deterministic-evaluator";
import {
  buildGapModelResponseSchemaV5,
} from "@/src/server/gap-analysis/generation-schema";

describe("guided-v4 deterministic category evaluator", () => {
  it.each([
    [["fully_implemented"], "fulfilled"],
    [["fully_implemented", "not_applicable"], "fulfilled"],
    [["unsure", "fully_implemented"], "insufficient_evidence"],
    [["partially_implemented", "unsure"], "partially_fulfilled"],
    [["not_implemented", "partially_implemented"], "not_fulfilled"],
    [["not_applicable", "not_applicable"], "insufficient_evidence"],
  ] as const)("evaluates %j as %s", (answers, expected) => {
    expect(evaluateGapCategory([...answers])).toBe(expected);
  });

  it("rejects empty, unknown, and duplicate inputs", () => {
    expect(() => evaluateGapCategory([])).toThrow("no answers");
    expect(() =>
      evaluateGapCategory(["invalid" as never]),
    ).toThrow("unknown");
    expect(() =>
      evaluateGapRequirement({
        gapAnalysisReleaseId: "release",
        questionnaireVersionId: "questionnaire",
        assessmentRevisionId: "revision",
        requirementVersionId: "requirement",
        answers: [
          {
            questionStableKey: "question",
            stableValue: "fully_implemented",
          },
          {
            questionStableKey: "question",
            stableValue: "fully_implemented",
          },
        ],
      }),
    ).toThrow("Duplicate");
  });

  it("hashes the ordered category input and changes with an answer", () => {
    const base = {
      gapAnalysisReleaseId: "release",
      questionnaireVersionId: "questionnaire",
      assessmentRevisionId: "revision",
      requirementVersionId: "requirement",
      answers: [
        {
          questionStableKey: "question",
          stableValue: "fully_implemented",
        },
      ],
    };
    expect(evaluateGapRequirement(base).inputHash).toBe(
      evaluateGapRequirement(base).inputHash,
    );
    expect(evaluateGapRequirement(base).inputHash).not.toBe(
      evaluateGapRequirement({
        ...base,
        answers: [{ ...base.answers[0], stableValue: "not_implemented" }],
      }).inputHash,
    );
  });

  it("rejects a model-supplied status in response schema v5", () => {
    const schema = buildGapModelResponseSchemaV5([
      {
        requirementCode: "NIS2-GOV-01",
        permittedCitationIds: ["L:1"],
        legalCitationIds: ["L:1"],
      },
    ]);
    const finding = {
      evidenceSufficiency: "sufficient",
      rationale: "Rationale",
      recommendation: "Recommendation",
      assumptions: [],
      legalCitation: "L:1",
      citations: [],
      contradictions: [],
      questionnaireDisagreements: [],
      requiresReview: false,
    };
    expect(
      schema.safeParse({ findings: { "NIS2-GOV-01": finding } }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        findings: {
          "NIS2-GOV-01": { ...finding, status: "fulfilled" },
        },
      }).success,
    ).toBe(false);
  });
});
