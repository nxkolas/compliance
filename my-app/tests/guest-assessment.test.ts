import { describe, expect, it } from "vitest";
import {
  calculateProgress,
  evaluateQuickCheck,
} from "@/src/server/guest-assessments/rules";
import {
  createGuestAssessmentSchema,
  saveGuestAnswersSchema,
} from "@/src/server/guest-assessments/validation";

describe("guest assessment result rules", () => {
  it("marks a covered medium organization as affected", () => {
    expect(
      evaluateQuickCheck({
        country: "DE",
        covered_sector: "yes",
        medium_threshold: "yes",
        special_entity: "no",
        lex_specialis: "no",
      }),
    ).toMatchObject({ result: "affected", category: "important" });
  });

  it("marks a special entity as affected independently of size", () => {
    expect(
      evaluateQuickCheck({
        country: "DE",
        covered_sector: "no",
        medium_threshold: "no",
        special_entity: "yes",
        lex_specialis: "no",
      }),
    ).toMatchObject({ result: "affected", category: "special_case" });
  });

  it("marks an organization outside covered sectors as not affected", () => {
    expect(
      evaluateQuickCheck({
        country: "DE",
        covered_sector: "no",
        medium_threshold: "yes",
        special_entity: "no",
        lex_specialis: "no",
      }),
    ).toMatchObject({ result: "not_affected", category: "not_affected" });
  });

  it.each([
    ["cross-border", { country: "EU", covered_sector: "yes", medium_threshold: "yes", special_entity: "no", lex_specialis: "no" }],
    ["uncertain", { country: "DE", covered_sector: "unsure", medium_threshold: "yes", special_entity: "no", lex_specialis: "no" }],
    ["lex specialis", { country: "DE", covered_sector: "yes", medium_threshold: "yes", special_entity: "no", lex_specialis: "yes" }],
    ["conflicting", { country: "DE", covered_sector: "yes", medium_threshold: "no", special_entity: "no", lex_specialis: "no" }],
  ])("requires review for %s answers", (_name, answers) => {
    expect(evaluateQuickCheck(answers)).toMatchObject({
      result: "possibly_affected",
      category: "unknown",
    });
  });
});

describe("guest assessment progress and validation", () => {
  it("calculates rounded required-question progress", () => {
    expect(calculateProgress(["a", "b", "c"], ["a", "c"])).toBe(67);
    expect(calculateProgress([], [])).toBe(100);
  });

  it("validates creation and answer payloads", () => {
    expect(
      createGuestAssessmentSchema.safeParse({ companyName: "Example GmbH" })
        .success,
    ).toBe(true);
    expect(
      createGuestAssessmentSchema.safeParse({ companyName: "" }).success,
    ).toBe(false);
    expect(
      saveGuestAnswersSchema.safeParse({
        answers: [
          {
            questionId: "7e39b6a5-6fb1-4e5e-a03d-3c065ad4d408",
            value: "yes",
          },
        ],
      }).success,
    ).toBe(true);
  });
});
