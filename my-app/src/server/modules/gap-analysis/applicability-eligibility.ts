import {
  parseStoredRuleEvaluationResult,
  type StoredRuleEvaluationResult,
} from "../applicability-check/domain";
import { ApiError } from "../../platform/http/errors";

export const GAP_ELIGIBLE_OUTCOMES = ["essential_entity", "important_entity"] as const;
export type GapEligibleOutcome = (typeof GAP_ELIGIBLE_OUTCOMES)[number];

export type GapApplicabilityArtifactCandidate = {
  id: string;
  definitionHash: string;
  gapEligible: boolean | null;
  result: unknown;
};

export type GapApplicabilityPrerequisite =
  | { status: "eligible"; outputRevisionId: string; outcome: GapEligibleOutcome }
  | { status: "missing" | "definition_incompatible" | "invalid" }
  | {
      status: "not_eligible";
      reason: "unsupported_country" | "clarification_required" | "not_directly_in_scope";
      outputRevisionId: string;
      outcome: "clarification_required" | "not_directly_in_scope";
      countryCode: string | null;
      unresolvedFactCodes: string[];
    };

export type GapPrerequisiteView =
  | { satisfied: true; status: "eligible"; destination: string }
  | {
      satisfied: false;
      status: "missing" | "definition_incompatible" | "invalid" | "not_eligible";
      reason?: "unsupported_country" | "clarification_required" | "not_directly_in_scope";
      outcome?: string;
      countryCode?: string | null;
      supportedCountryCodes: string[];
      destination: string;
    };

export function evaluateGapApplicabilityPrerequisite(
  compatibleDefinitionHash: string,
  candidate: GapApplicabilityArtifactCandidate | null | undefined,
): GapApplicabilityPrerequisite {
  if (!candidate) return { status: "missing" };
  if (candidate.definitionHash !== compatibleDefinitionHash) {
    return { status: "definition_incompatible" };
  }
  let result: StoredRuleEvaluationResult;
  try {
    const stored = candidate.result as { evidence?: unknown };
    result = parseStoredRuleEvaluationResult(stored?.evidence ?? candidate.result);
  } catch {
    return { status: "invalid" };
  }
  if (candidate.gapEligible && isGapEligibleOutcome(result.outcome)) {
    return { status: "eligible", outputRevisionId: candidate.id, outcome: result.outcome };
  }
  if (isGapEligibleOutcome(result.outcome)) return { status: "invalid" };
  return {
    status: "not_eligible",
    reason: getIneligibilityReason(result),
    outputRevisionId: candidate.id,
    outcome: result.outcome,
    countryCode: result.jurisdiction.countryCode,
    unresolvedFactCodes: [...result.unresolvedFactCodes],
  };
}

export function assertGapApplicabilityEligible(
  prerequisite: GapApplicabilityPrerequisite,
): Extract<GapApplicabilityPrerequisite, { status: "eligible" }> {
  if (prerequisite.status === "eligible") return prerequisite;
  if (prerequisite.status === "not_eligible") {
    throw new ApiError(409, "The applicability result is not eligible for Gap Analysis", prerequisite, "GAP_APPLICABILITY_NOT_ELIGIBLE");
  }
  const failure = {
    missing: ["An applicability result is required for Gap Analysis", "GAP_APPLICABILITY_MISSING"],
    definition_incompatible: ["The applicability result uses an obsolete definition", "GAP_APPLICABILITY_DEFINITION_INCOMPATIBLE"],
    invalid: ["The stored applicability result is invalid", "GAP_APPLICABILITY_INVALID"],
  } as const;
  throw new ApiError(409, failure[prerequisite.status][0], undefined, failure[prerequisite.status][1]);
}

export function projectGapPrerequisiteView(input: {
  prerequisite: GapApplicabilityPrerequisite;
  supportedCountryCodes: string[];
  destination: string;
}): GapPrerequisiteView {
  const prerequisite = input.prerequisite;
  if (prerequisite.status === "eligible") {
    return { satisfied: true, status: "eligible", destination: input.destination };
  }
  return {
    satisfied: false,
    status: prerequisite.status,
    ...(prerequisite.status === "not_eligible"
      ? { reason: prerequisite.reason, outcome: prerequisite.outcome, countryCode: prerequisite.countryCode }
      : {}),
    supportedCountryCodes: [...input.supportedCountryCodes],
    destination: input.destination,
  };
}

export function assertGapRequirementsAvailable<T>(requirements: T[]): [T, ...T[]] {
  if (requirements.length) return requirements as [T, ...T[]];
  throw new ApiError(409, "No Gap requirements are available for the applicability outcome", undefined, "GAP_REQUIREMENTS_UNAVAILABLE");
}

export function resolveGapGenerationPrerequisites<
  A extends GapApplicabilityArtifactCandidate,
  T extends { applicabilityOutcomeCodes: string[] },
>(input: {
  compatibleDefinitionHash: string;
  artifact: A | null | undefined;
  requirements: T[];
}) {
  const applicability = assertGapApplicabilityEligible(
    evaluateGapApplicabilityPrerequisite(input.compatibleDefinitionHash, input.artifact),
  );
  return {
    applicability,
    artifact: input.artifact as A,
    requirements: assertGapRequirementsAvailable(
      input.requirements.filter((item) => item.applicabilityOutcomeCodes.includes(applicability.outcome)),
    ),
  };
}

function isGapEligibleOutcome(outcome: string): outcome is GapEligibleOutcome {
  return (GAP_ELIGIBLE_OUTCOMES as readonly string[]).includes(outcome);
}

function getIneligibilityReason(result: StoredRuleEvaluationResult) {
  if (result.unresolvedFactCodes.includes("unresolved_unsupported_profile")) return "unsupported_country" as const;
  if (result.outcome === "not_directly_in_scope") return "not_directly_in_scope" as const;
  return "clarification_required" as const;
}
