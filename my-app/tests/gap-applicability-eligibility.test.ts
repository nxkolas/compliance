import { describe, expect, it } from "vitest";
import {
  evaluateGapApplicabilityPrerequisite,
  resolveGapGenerationPrerequisites,
} from "@/src/server/gap-analysis/applicability-eligibility";
import {
  fixtureCheckReleaseId,
  storedApplicabilityResult,
} from "./support/stored-applicability-result";

function candidate(
  outcome: "essential_entity" | "important_entity" | "clarification_required" | "not_directly_in_scope",
  unresolvedFactCodes: string[] = [],
) {
  return {
    id: `artifact-${outcome}`,
    definitionHash: fixtureCheckReleaseId,
    gapEligible: outcome === "essential_entity" || outcome === "important_entity",
    result: storedApplicabilityResult({
      outcome,
      countryCode: outcome === "clarification_required" ? "FR" : "DE",
      unresolvedFactCodes,
    }),
  };
}

describe("Gap applicability eligibility", () => {
  it.each(["essential_entity", "important_entity"] as const)(
    "accepts %s",
    (outcome) => {
      expect(
        evaluateGapApplicabilityPrerequisite(
          fixtureCheckReleaseId,
          candidate(outcome),
        ),
      ).toMatchObject({ status: "eligible", outcome });
    },
  );

  it.each([
    [
      "clarification_required",
      [],
      "clarification_required",
    ],
    [
      "clarification_required",
      ["unresolved_unsupported_profile"],
      "unsupported_country",
    ],
    ["not_directly_in_scope", [], "not_directly_in_scope"],
  ] as const)(
    "classifies %s using reason precedence",
    (outcome, unresolvedFactCodes, reason) => {
      expect(
        evaluateGapApplicabilityPrerequisite(
          fixtureCheckReleaseId,
          candidate(outcome, [...unresolvedFactCodes]),
        ),
      ).toMatchObject({ status: "not_eligible", reason, outcome });
    },
  );

  it("rejects an eligible result with no applicable requirements", () => {
    expect(() =>
      resolveGapGenerationPrerequisites({
        compatibleDefinitionHash: fixtureCheckReleaseId,
        artifact: candidate("essential_entity"),
        requirements: [
          { applicabilityOutcomeCodes: ["important_entity"] },
        ],
      }),
    ).toThrow(
      expect.objectContaining({ code: "GAP_REQUIREMENTS_UNAVAILABLE" }),
    );
  });
});
