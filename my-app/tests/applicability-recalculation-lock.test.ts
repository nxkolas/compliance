import { describe, expect, it } from "vitest";
import {
  assertApplicabilityRecalculationUnlocked,
  deriveApplicabilityRecalculationLock,
  deriveApplicabilityRecalculationLockForPrerequisite,
} from "@/src/server/applicability-check/recalculation-lock";

describe("applicability recalculation lock", () => {
  it("remains open before a Gap Analysis assessment exists", () => {
    const lock = deriveApplicabilityRecalculationLock(null);
    expect(lock).toEqual({ locked: false, gapAssessmentId: null });
    expect(() => assertApplicabilityRecalculationUnlocked(lock)).not.toThrow();
  });

  it("locks once the Gap Analysis has pinned the applicability result", () => {
    const lock = deriveApplicabilityRecalculationLock("gap-assessment-1");
    expect(lock).toEqual({
      locked: true,
      gapAssessmentId: "gap-assessment-1",
    });
    expect(() => assertApplicabilityRecalculationUnlocked(lock)).toThrow(
      expect.objectContaining({
        status: 409,
        code: "APPLICABILITY_RECALCULATION_LOCKED",
      }),
    );
  });

  it("locks only for an active assessment whose pinned result is eligible", () => {
    expect(
      deriveApplicabilityRecalculationLockForPrerequisite(
        "gap-assessment-1",
        {
          status: "eligible",
          artifactRevisionId: "artifact-1",
          outcome: "important_entity",
        },
      ),
    ).toEqual({
      locked: true,
      gapAssessmentId: "gap-assessment-1",
    });
  });

  it.each([
    { status: "missing" as const },
    { status: "release_incompatible" as const },
    { status: "not_approved" as const },
    { status: "invalid" as const },
    {
      status: "not_eligible" as const,
      reason: "clarification_required" as const,
      artifactRevisionId: "artifact-1",
      outcome: "clarification_required" as const,
      countryCode: "FR",
      unresolvedFactCodes: [],
    },
    {
      status: "not_eligible" as const,
      reason: "not_directly_in_scope" as const,
      artifactRevisionId: "artifact-2",
      outcome: "not_directly_in_scope" as const,
      countryCode: "FR",
      unresolvedFactCodes: [],
    },
  ])("fails open for $status pinned state", (prerequisite) => {
    expect(
      deriveApplicabilityRecalculationLockForPrerequisite(
        "gap-assessment-1",
        prerequisite,
      ),
    ).toEqual({ locked: false, gapAssessmentId: null });
  });
});
