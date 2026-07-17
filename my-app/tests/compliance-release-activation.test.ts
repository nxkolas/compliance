import { describe, expect, it } from "vitest";
import { nis2ReleaseDefinition } from "@/src/server/compliance/nis2/releases/2026-v1/release";
import { compileRelease } from "@/src/server/compliance/publishing/compile-release";
import {
  assertActivationCompleteness,
  type ActivationCompletenessSnapshot,
} from "@/src/server/compliance/publishing/activation-completeness";

describe("compliance release activation completeness", () => {
  it("accepts a complete pinned German release", () => {
    expect(() => assertActivationCompleteness(snapshot())).not.toThrow();
  });

  it("fails closed when relational effective-state rows are incomplete", () => {
    const value = snapshot();
    value.profiles[0].effectiveStateCodes = value.profiles[0].effectiveStateCodes.filter(
      (code) => code !== "de_bsi_kritisv_section_12_repeal_trigger",
    );

    expect(() => assertActivationCompleteness(value)).toThrow(
      /missing effective state de_bsi_kritisv_section_12_repeal_trigger/,
    );
  });
});

function snapshot(): ActivationCompletenessSnapshot {
  const { artifact } = compileRelease(nis2ReleaseDefinition);
  if (artifact.kind !== "nis2_scope_v3") throw new Error("Expected v3 artifact");
  const profile = artifact.countryProfiles.DE;
  return {
    releasePublished: true,
    aggregateHash: "a".repeat(64),
    evaluatorKind: "nis2_scope_v3",
    evaluatorVersion: 3,
    ruleSet: {
      status: "published",
      publishedAt: new Date(),
      evaluatorKind: "nis2_scope_v3",
      evaluatorVersion: 3,
      rules: artifact,
    },
    questionnairePublished: true,
    scopeModelPublished: true,
    thresholdSetPublished: true,
    factVersionCount: 12,
    contentRevisionCount: nis2ReleaseDefinition.content.length,
    profiles: [
      {
        countryCode: "DE",
        published: true,
        nationalIdentityCount: profile.entityCatalog.length,
        nationalMappingCount: profile.entityCatalog.flatMap((entity) => entity.mappings).length,
        effectiveStateCodes: profile.effectiveStates.map((state) => state.code),
      },
    ],
  };
}
