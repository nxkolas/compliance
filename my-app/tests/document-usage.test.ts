import { describe, expect, it } from "vitest";
import { deriveDocumentUsageLabels } from "@/src/server/documents/usage";

describe("deriveDocumentUsageLabels", () => {
  it("projects accepted, candidate, draft, and active-plan usage independently", () => {
    const artifactSources = [
      {
        documentVersionId: "accepted-version",
        revisionId: "approved-a",
        currentRevisionId: "candidate-b",
        acceptedRevisionId: "approved-a",
      },
      {
        documentVersionId: "candidate-version",
        revisionId: "candidate-b",
        currentRevisionId: "candidate-b",
        acceptedRevisionId: "approved-a",
      },
    ];
    expect(labels("accepted-version", artifactSources)).toEqual([
      "used_in_approved_revision",
      "supports_active_plan",
    ]);
    expect(labels("candidate-version", artifactSources)).toEqual([
      "used_in_open_draft",
      "used_in_candidate_revision",
    ]);
    expect(labels("unused", artifactSources)).toEqual(["not_assessed"]);
  });
});

function labels(
  versionId: string,
  artifactSources: Parameters<typeof deriveDocumentUsageLabels>[0]["artifactSources"],
) {
  return deriveDocumentUsageLabels({
    versionId,
    artifactSources,
    draftVersionIds: new Set(["candidate-version"]),
    activePlanVersionIds: new Set(["accepted-version"]),
  });
}
