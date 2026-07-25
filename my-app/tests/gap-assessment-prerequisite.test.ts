import { describe, expect, it, vi } from "vitest";
import { requireApprovedApplicabilityArtifact } from "@/src/server/gap-analysis/assessment-service";
import {
  fixtureCheckReleaseId,
  storedApplicabilityResult,
} from "./support/stored-applicability-result";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

describe("gap-assessment applicability prerequisite", () => {
  it("accepts only a parsed positive approved artifact for the compatible release", () => {
    const result = requireApprovedApplicabilityArtifact(
      fixtureCheckReleaseId,
      [
        {
          id: "approved",
          checkReleaseId: fixtureCheckReleaseId,
          status: "approved",
          result: storedApplicabilityResult(),
        },
      ],
    );
    expect(result).toMatchObject({
      artifactRevisionId: "approved",
      outcome: "essential_entity",
    });
  });

  it("rejects a compatible approved non-positive artifact with structured details", () => {
    expect(() =>
      requireApprovedApplicabilityArtifact(fixtureCheckReleaseId, [
        {
          id: "unsupported",
          checkReleaseId: fixtureCheckReleaseId,
          status: "approved",
          result: storedApplicabilityResult({
            outcome: "clarification_required",
            countryCode: "FR",
            unresolvedFactCodes: ["unresolved_unsupported_profile"],
          }),
        },
      ]),
    ).toThrow(
      expect.objectContaining({
        status: 409,
        code: "GAP_APPLICABILITY_NOT_ELIGIBLE",
        details: {
          outcome: "clarification_required",
          countryCode: "FR",
          unresolvedFactCodes: ["unresolved_unsupported_profile"],
        },
      }),
    );
  });

  it("keeps release, approval, and malformed failures distinct", () => {
    expect(() =>
      requireApprovedApplicabilityArtifact(fixtureCheckReleaseId, []),
    ).toThrow(expect.objectContaining({ code: "GAP_APPLICABILITY_MISSING" }));
    expect(() =>
      requireApprovedApplicabilityArtifact(fixtureCheckReleaseId, [
        {
          id: "other",
          checkReleaseId: "00000000-0000-4000-8000-000000000099",
          status: "approved",
          result: storedApplicabilityResult(),
        },
      ]),
    ).toThrow(
      expect.objectContaining({
        code: "GAP_APPLICABILITY_RELEASE_INCOMPATIBLE",
      }),
    );
    expect(() =>
      requireApprovedApplicabilityArtifact(fixtureCheckReleaseId, [
        {
          id: "generated",
          checkReleaseId: fixtureCheckReleaseId,
          status: "generated",
          result: storedApplicabilityResult(),
        },
      ]),
    ).toThrow(
      expect.objectContaining({ code: "GAP_APPLICABILITY_NOT_APPROVED" }),
    );
    expect(() =>
      requireApprovedApplicabilityArtifact(fixtureCheckReleaseId, [
        {
          id: "invalid",
          checkReleaseId: fixtureCheckReleaseId,
          status: "approved",
          result: { outcome: "essential_entity" },
        },
      ]),
    ).toThrow(expect.objectContaining({ code: "GAP_APPLICABILITY_INVALID" }));
  });
});
