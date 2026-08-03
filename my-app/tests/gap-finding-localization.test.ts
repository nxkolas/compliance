import { describe, expect, it } from "vitest";
import { localizeGapFinding } from "@/src/server/gap-analysis/finding-localization";
import type { LoadedGapRelease } from "@/src/server/gap-analysis/release-loader";

function requirement(
  title: string,
  requirementText: string,
): LoadedGapRelease["requirements"][number] {
  return {
    id: "requirement-version",
    stableRequirementId: "stable-requirement",
    code: "access-control",
    position: 3,
    icon: "KeyRound",
    criticality: "high",
    title,
    requirementText,
    legalReferences: [],
    applicabilityOutcomeCodes: ["essential_entity"],
    questionStableKeys: ["question"],
  };
}

describe("Gap finding localization", () => {
  it.each([
    ["German title", "German text"],
    ["English title", "English text"],
  ])("enriches raw finding rows with catalogue wording", (title, text) => {
    const row = {
      finding: { requirementVersionId: "requirement-version" },
      requirement: {
        id: "requirement-version",
        requirementId: "database-stable-requirement",
        titleContentRevisionId: "title-revision",
        requirementTextContentRevisionId: "text-revision",
      },
      evidence: [],
    };

    expect(
      localizeGapFinding(
        row,
        new Map([
          ["requirement-version", requirement(title, text)],
        ]),
      ),
    ).toMatchObject({
      requirement: {
        stableRequirementId: "stable-requirement",
        position: 3,
        icon: "KeyRound",
        title,
        requirementText: text,
      },
    });
  });

  it("fails closed when a finding is absent from its pinned catalogue", () => {
    expect(() =>
      localizeGapFinding(
        {
          finding: { requirementVersionId: "missing" },
          requirement: {},
        },
        new Map(),
        "release-1",
      ),
    ).toThrow(
      /Pinned requirement missing is absent from the localized Gap release catalogue release-1/,
    );
  });
});
