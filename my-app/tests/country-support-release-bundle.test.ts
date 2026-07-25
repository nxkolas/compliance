import { describe, expect, it } from "vitest";
import { getSupportedCountryCodes } from "@/src/server/applicability-check/country-support";
import { evaluateRuleSet } from "@/src/server/applicability-check/rules";
import { groundingPolicyDefinitions } from "@/src/server/ai/grounding/policy-definition";
import { compileRelease } from "@/src/server/compliance/publishing/compile-release";
import { nis2ReleaseDefinition } from "@/src/server/compliance/nis2/releases/2026-v1/release";
import { singleLifecycleGapRelease } from "@/src/server/gap-analysis/releases/guided-v3/release";

describe("current Germany country-support bundle", () => {
  it("ships one complete supported country with matching Gap and grounding inputs", () => {
    const { artifact } = compileRelease(nis2ReleaseDefinition);
    const germanProfile = artifact.countryProfiles.DE;
    const coveredOutcomes = new Set(
      singleLifecycleGapRelease.requirementSet.requirements.flatMap(
        (requirement) => requirement.applicableOutcomeCodes,
      ),
    );

    expect(getSupportedCountryCodes(artifact)).toEqual(["DE"]);
    expect(germanProfile.supported).toBe(true);
    expect(
      "entityCatalog" in germanProfile
        ? germanProfile.entityCatalog.length
        : 0,
    ).toBeGreaterThan(0);
    expect(germanProfile.legalProvisionKeys.length).toBeGreaterThan(0);
    expect(coveredOutcomes).toEqual(
      new Set(["essential_entity", "important_entity"]),
    );
    expect(nis2ReleaseDefinition.requiredCorpusFamilies).toEqual(
      expect.arrayContaining(["nis2-eu-primary", "nis2-de-primary"]),
    );
    expect(singleLifecycleGapRelease.requiredCorpusFamilies).toEqual(
      expect.arrayContaining(["nis2-eu-primary", "nis2-de-primary"]),
    );
    expect(
      groundingPolicyDefinitions.gap_analysis.jurisdictionCodes,
    ).toEqual(expect.arrayContaining(["EU", "DE"]));
  });

  it("keeps unsupported FR deterministic without inventing a national classification", () => {
    const { artifact } = compileRelease(nis2ReleaseDefinition);
    const fixture = nis2ReleaseDefinition.fixtures.find(
      (candidate) => candidate.name === "unsupported-negative",
    );
    if (!fixture) throw new Error("Unsupported-country fixture is missing");

    const unsupported = evaluateRuleSet(artifact, {
      facts: fixture.facts,
    });
    const noEuActivity = evaluateRuleSet(artifact, {
      facts: { ...fixture.facts, eu_activity: "no" },
    });

    expect(unsupported).toMatchObject({
      outcome: "clarification_required",
      unresolvedFactCodes: expect.arrayContaining([
        "unresolved_unsupported_profile",
      ]),
    });
    expect(noEuActivity.outcome).toBe("not_directly_in_scope");
  });
});
