import { describe, expect, it } from "vitest";
import { getSupportedCountryCodes } from "@/src/server/modules/applicability-check/country-support";
import { evaluateRuleSet } from "@/src/server/modules/compliance/nis2/rules";
import { nis2GroundingPolicy } from "@/src/server/modules/grounding/policy-definition";
import { compileRelease } from "@/src/server/modules/compliance/publishing/compile-release";
import { nis2ReleaseDefinition } from "@/src/server/modules/compliance/nis2/releases/2026-v1/release";
import { guidedV6GapRelease } from "@/src/server/modules/gap-analysis/releases/guided-v6/release";

describe("current Germany country-support bundle", () => {
  it("ships one complete supported country with matching Gap and grounding inputs", () => {
    const { artifact } = compileRelease(nis2ReleaseDefinition);
    const germanProfile = artifact.countryProfiles.DE;
    const coveredOutcomes = new Set(
      guidedV6GapRelease.requirementSet.requirements.flatMap(
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
    expect(guidedV6GapRelease.requiredCorpusFamilies).toEqual(
      expect.arrayContaining(["nis2-eu-primary", "nis2-de-primary"]),
    );
    expect(
      nis2GroundingPolicy.jurisdictionCodes,
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
