import type { Nis2Outcome } from "@/src/server/applicability-check/rule-set-schema";

const defaultCheckReleaseId = "00000000-0000-4000-8000-000000000010";

export function storedApplicabilityResult(input?: {
  checkReleaseId?: string;
  outcome?: Nis2Outcome;
  countryCode?: string | null;
  unresolvedFactCodes?: string[];
}) {
  const outcome = input?.outcome ?? "essential_entity";
  return {
    schemaVersion: 4 as const,
    evaluatorKind: "nis2_scope_v3" as const,
    evaluatorVersion: 3 as const,
    outcome,
    reasonCodes: ["fixture_reason"],
    releaseVersion: "2026-v1",
    scopeModelVersion: "nis2-scope-v3",
    thresholdSetVersion: "eu-sme-2026",
    profileVersionKey:
      input?.countryCode === "DE" ? "de-profile-2026" : null,
    jurisdiction: {
      euActivity:
        outcome === "not_directly_in_scope" ? ("no" as const) : ("yes" as const),
      countryCode: input?.countryCode ?? "DE",
      basisCode: "establishment",
    },
    sizeClassification: "medium" as const,
    matchedEntityTypes: [],
    scopeBases: [],
    unresolvedFactCodes: input?.unresolvedFactCodes ?? [],
    obligationOverlays: [],
    indirectExposure: {
      status: "none" as const,
      reasonCodes: [],
    },
    decisiveFacts: {},
    selectedCatalogCode: null,
    matchedNationalEntityTypes: [],
    nationalMappings: [],
    appliedProfilePolicyCodes: [],
    appliedProfileLegalProvisionKeys: [],
    appliedJurisdictionRules: [],
    effectiveStateCodes: [],
    effectiveStateDeclarations: [],
    checkReleaseId: input?.checkReleaseId ?? defaultCheckReleaseId,
    ruleSetId: "00000000-0000-4000-8000-000000000011",
    inputHash: "a".repeat(64),
    evaluatedAt: "2026-07-25T12:00:00.000Z",
  };
}

export const fixtureCheckReleaseId = defaultCheckReleaseId;
