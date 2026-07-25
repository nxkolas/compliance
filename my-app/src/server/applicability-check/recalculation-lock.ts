import { ApiError } from "../api/errors";
import type { GapApplicabilityPrerequisite } from "../gap-analysis/domain";

export type ApplicabilityRecalculationLock = {
  locked: boolean;
  gapAssessmentId: string | null;
};

export function deriveApplicabilityRecalculationLock(
  gapAssessmentId: string | null | undefined,
): ApplicabilityRecalculationLock {
  return {
    locked: Boolean(gapAssessmentId),
    gapAssessmentId: gapAssessmentId ?? null,
  };
}

export function deriveApplicabilityRecalculationLockForPrerequisite(
  gapAssessmentId: string | null | undefined,
  prerequisite: GapApplicabilityPrerequisite,
): ApplicabilityRecalculationLock {
  return deriveApplicabilityRecalculationLock(
    prerequisite.status === "eligible" ? gapAssessmentId : null,
  );
}

export function assertApplicabilityRecalculationUnlocked(
  lock: ApplicabilityRecalculationLock,
) {
  if (!lock.locked) return;
  throw new ApiError(
    409,
    "The applicability check is locked because it is an input to the Gap Analysis",
    { gapAssessmentId: lock.gapAssessmentId },
    "APPLICABILITY_RECALCULATION_LOCKED",
  );
}
