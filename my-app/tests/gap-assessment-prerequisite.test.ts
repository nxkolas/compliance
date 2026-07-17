import { describe, expect, it, vi } from "vitest";
import { requireApprovedApplicabilityArtifact } from "@/src/server/gap-analysis/assessment-service";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

describe("gap-assessment applicability prerequisite", () => {
  it("accepts only an approved artifact for the compatible release", () => {
    const result = requireApprovedApplicabilityArtifact("release-1", [
      { id: "old", checkReleaseId: "release-0", status: "approved" },
      { id: "generated", checkReleaseId: "release-1", status: "generated" },
      { id: "approved", checkReleaseId: "release-1", status: "approved" },
    ]);
    expect(result.id).toBe("approved");
  });

  it("fails closed for generated or incompatible artifacts", () => {
    expect(() =>
      requireApprovedApplicabilityArtifact("release-1", [
        { id: "generated", checkReleaseId: "release-1", status: "generated" },
        { id: "other", checkReleaseId: "release-0", status: "approved" },
      ]),
    ).toThrow(/approved applicability result/i);
  });
});
