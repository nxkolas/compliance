import {
  parseStoredRuleEvaluationResult,
  type StoredRuleEvaluationResult,
} from "../applicability-check/domain";
import { ApiError } from "../api/errors";

export const GAP_ELIGIBLE_OUTCOMES = [
  "essential_entity",
  "important_entity",
] as const;

export type GapEligibleOutcome = (typeof GAP_ELIGIBLE_OUTCOMES)[number];

export type GapApplicabilityArtifactCandidate = {
  id: string;
  checkReleaseId: string | null;
  status: string;
  result: unknown;
};

export type GapApplicabilityPrerequisite =
  | {
      status: "eligible";
      artifactRevisionId: string;
      outcome: GapEligibleOutcome;
    }
  | {
      status:
        | "missing"
        | "release_incompatible"
        | "not_approved"
        | "invalid";
    }
  | {
      status: "not_eligible";
      reason:
        | "unsupported_country"
        | "clarification_required"
        | "not_directly_in_scope";
      artifactRevisionId: string;
      outcome: "clarification_required" | "not_directly_in_scope";
      countryCode: string | null;
      unresolvedFactCodes: string[];
    };

export type GapPrerequisiteView =
  | {
      satisfied: true;
      status: "eligible";
      destination: string;
    }
  | {
      satisfied: false;
      status:
        | "missing"
        | "release_incompatible"
        | "not_approved"
        | "invalid"
        | "not_eligible";
      reason?:
        | "unsupported_country"
        | "clarification_required"
        | "not_directly_in_scope";
      outcome?: string;
      countryCode?: string | null;
      supportedCountryCodes: string[];
      destination: string;
    };

export function evaluateGapApplicabilityPrerequisite(
  compatibleCheckReleaseId: string,
  candidate: GapApplicabilityArtifactCandidate | null | undefined,
): GapApplicabilityPrerequisite {
  if (!candidate) return { status: "missing" };
  if (candidate.checkReleaseId !== compatibleCheckReleaseId) {
    return { status: "release_incompatible" };
  }
  if (candidate.status !== "approved") return { status: "not_approved" };

  let result: StoredRuleEvaluationResult;
  try {
    result = parseStoredRuleEvaluationResult(candidate.result);
  } catch {
    return { status: "invalid" };
  }
  if (
    result.checkReleaseId !== compatibleCheckReleaseId ||
    result.checkReleaseId !== candidate.checkReleaseId
  ) {
    return { status: "invalid" };
  }
  if (isGapEligibleOutcome(result.outcome)) {
    return {
      status: "eligible",
      artifactRevisionId: candidate.id,
      outcome: result.outcome,
    };
  }

  return {
    status: "not_eligible",
    reason: getIneligibilityReason(result),
    artifactRevisionId: candidate.id,
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
    throw new ApiError(
      409,
      "The applicability result is not eligible for Gap Analysis",
      {
        outcome: prerequisite.outcome,
        countryCode: prerequisite.countryCode,
        unresolvedFactCodes: prerequisite.unresolvedFactCodes,
      },
      "GAP_APPLICABILITY_NOT_ELIGIBLE",
    );
  }

  const failures = {
    missing: {
      message: "An applicability result is required for Gap Analysis",
      code: "GAP_APPLICABILITY_MISSING",
    },
    release_incompatible: {
      message:
        "The applicability result is incompatible with the active Gap release",
      code: "GAP_APPLICABILITY_RELEASE_INCOMPATIBLE",
    },
    not_approved: {
      message: "An approved applicability result is required for Gap Analysis",
      code: "GAP_APPLICABILITY_NOT_APPROVED",
    },
    invalid: {
      message: "The stored applicability result is invalid",
      code: "GAP_APPLICABILITY_INVALID",
    },
  } as const;
  const failure = failures[prerequisite.status];
  throw new ApiError(409, failure.message, undefined, failure.code);
}

export function projectGapPrerequisiteView(input: {
  prerequisite: GapApplicabilityPrerequisite;
  supportedCountryCodes: string[];
  destination: string;
}): GapPrerequisiteView {
  if (input.prerequisite.status === "eligible") {
    return {
      satisfied: true,
      status: "eligible",
      destination: input.destination,
    };
  }
  if (input.prerequisite.status === "not_eligible") {
    return {
      satisfied: false,
      status: "not_eligible",
      reason: input.prerequisite.reason,
      outcome: input.prerequisite.outcome,
      countryCode: input.prerequisite.countryCode,
      supportedCountryCodes: [...input.supportedCountryCodes],
      destination: input.destination,
    };
  }
  return {
    satisfied: false,
    status: input.prerequisite.status,
    supportedCountryCodes: [...input.supportedCountryCodes],
    destination: input.destination,
  };
}

export function assertGapRequirementsAvailable<T>(
  requirements: T[],
): [T, ...T[]] {
  if (requirements.length > 0) return requirements as [T, ...T[]];
  throw new ApiError(
    409,
    "No Gap requirements are available for the applicability outcome",
    undefined,
    "GAP_REQUIREMENTS_UNAVAILABLE",
  );
}

export function resolveGapGenerationPrerequisites<
  A extends GapApplicabilityArtifactCandidate,
  T extends { applicabilityOutcomeCodes: string[] },
>(input: {
  compatibleCheckReleaseId: string;
  artifact: A | null | undefined;
  requirements: T[];
}) {
  const applicability = assertGapApplicabilityEligible(
    evaluateGapApplicabilityPrerequisite(
      input.compatibleCheckReleaseId,
      input.artifact,
    ),
  );
  const requirements = assertGapRequirementsAvailable(
    input.requirements.filter((requirement) =>
      requirement.applicabilityOutcomeCodes.includes(
        applicability.outcome,
      ),
    ),
  );
  return {
    applicability,
    artifact: input.artifact as A,
    requirements,
  };
}

function isGapEligibleOutcome(outcome: string): outcome is GapEligibleOutcome {
  return (GAP_ELIGIBLE_OUTCOMES as readonly string[]).includes(outcome);
}

function getIneligibilityReason(
  result: StoredRuleEvaluationResult,
):
  | "unsupported_country"
  | "clarification_required"
  | "not_directly_in_scope" {
  if (
    result.unresolvedFactCodes.includes("unresolved_unsupported_profile")
  ) {
    return "unsupported_country";
  }
  if (result.outcome === "not_directly_in_scope") {
    return "not_directly_in_scope";
  }
  return "clarification_required";
}
