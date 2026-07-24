import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/db", () => ({ db: {} }));

import { getGapAnalysisWorkflow } from "@/src/server/gap-analysis/workflow-reader";
import type { LoadedGapRelease } from "@/src/server/gap-analysis/release-loader";

function release(
  id: string,
  requirementId: string,
  title: string,
): LoadedGapRelease {
  return {
    id,
    releaseCode: "nis2-gap",
    versionLabel: id,
    moduleId: "module",
    moduleTitle: "Gap",
    questionnaireId: "questionnaire",
    questionnaireVersionId: "questionnaire-version",
    questionnaireTitle: "Questions",
    requirementSetTitle: "Requirements",
    compatibleCheckReleaseId: "check-release",
    prompt: {
      name: "gap",
      version: "1",
      templateHash: "hash",
      responseSchemaVersion: "1",
    },
    evaluator: { kind: "deterministic", version: 1 },
    modelPolicy: {},
    questions: [],
    requirements: [
      {
        id: requirementId,
        stableRequirementId: "stable-requirement",
        code: "access-control",
        position: 1,
        criticality: "high",
        title,
        requirementText: `${title} text`,
        recommendation: "Recommendation",
        legalReferences: [],
        applicabilityOutcomeCodes: ["essential_entity"],
        questionStableKeys: ["question"],
      },
    ],
  };
}

function finding(requirementVersionId: string, revisionId: string) {
  return {
    finding: {
      id: `finding-${revisionId}`,
      artifactRevisionId: revisionId,
      requirementVersionId,
      status: "not_fulfilled" as const,
      requiresReview: false,
    },
    requirement: {
      id: requirementVersionId,
      code: "access-control",
      requirementId: "raw-stable-requirement",
    },
    evidence: [],
  };
}

describe("Gap workflow localization", () => {
  it("uses each result revision's pinned release catalogue", async () => {
    const activeRelease = release(
      "release-new",
      "requirement-new",
      "New localized title",
    );
    const historicalRelease = release(
      "release-old",
      "requirement-old",
      "Historical localized title",
    );
    const acceptedRevision = {
      id: "accepted",
      gapAnalysisReleaseId: historicalRelease.id,
      result: {},
    };
    const candidateRevision = {
      id: "candidate",
      gapAnalysisReleaseId: activeRelease.id,
      result: {},
    };
    const reader = {
      readGap: vi.fn(async () => ({
        release: activeRelease,
        revision: candidateRevision,
        acceptedRevision,
        candidateRevision,
        findings: [finding("requirement-new", "candidate")],
        acceptedFindings: [finding("requirement-old", "accepted")],
        candidateFindings: [finding("requirement-new", "candidate")],
        answers: {},
        reassessment: null,
        documentLibrary: { documents: [] },
        activePlan: null,
        run: null,
        history: [],
      })),
    };
    const releaseReader = {
      getPublished: vi.fn(async ({ releaseId }: { releaseId: string }) =>
        releaseId === historicalRelease.id ? historicalRelease : null,
      ),
    };

    const workflow = await getGapAnalysisWorkflow(
      {
        userId: "user",
        organizationId: "organization",
        locale: "en",
      },
      reader as never,
      releaseReader,
    );

    expect(workflow.findings[0].requirement.title).toBe(
      "New localized title",
    );
    expect(workflow.acceptedFindings[0].requirement.title).toBe(
      "Historical localized title",
    );
    expect(workflow.candidateFindings[0].requirement.requirementText).toBe(
      "New localized title text",
    );
    expect(releaseReader.getPublished).toHaveBeenCalledOnce();
    expect(releaseReader.getPublished).toHaveBeenCalledWith({
      releaseId: "release-old",
      locale: "en",
    });
  });
});
