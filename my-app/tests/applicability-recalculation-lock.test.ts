import { describe, expect, it } from "vitest";
import {
  assertApplicabilityRecalculationUnlocked,
  deriveApplicabilityRecalculationLock,
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
});
