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
    actionPlanPrompt: {
      name: "action-plan",
      version: "1",
      templateHash: "action-hash",
      responseSchemaVersion: "1",
    },
    evaluator: { kind: "deterministic", version: 1 },
    questions: [],
    requirements: [
      {
        id: requirementId,
        stableRequirementId: "stable-requirement",
        code: "access-control",
        position: 1,
        icon: "KeyRound",
        criticality: "high",
        title,
        requirementText: `${title} text`,
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
    const newRequirementId = "db04d289-e7aa-4548-9674-f50a5e62aa72";
    const oldRequirementId = "ef69e5aa-88ec-4527-ae79-df059c6e74df";
    const activeRelease = release(
      "release-new",
      newRequirementId,
      "New localized title",
    );
    const historicalRelease = release(
      "release-old",
      oldRequirementId,
      "Historical localized title",
    );
    const acceptedRevision = {
      id: "accepted",
      gapAnalysisReleaseId: historicalRelease.id,
      result: {
        schemaKind: "gap_revision_metadata_v1",
        outputLocale: "en",
        findingDiagnostics: [{
          requirementVersionId: oldRequirementId,
          contradictions: [],
          questionnaireDisagreements: [],
        }],
        correctedFromRevisionId: null,
        correctedRequirementVersionIds: [],
      },
    };
    const candidateRevision = {
      id: "candidate",
      gapAnalysisReleaseId: activeRelease.id,
      result: {
        schemaKind: "gap_revision_metadata_v1",
        outputLocale: "en",
        findingDiagnostics: [{
          requirementVersionId: newRequirementId,
          contradictions: [],
          questionnaireDisagreements: [],
        }],
        correctedFromRevisionId: null,
        correctedRequirementVersionIds: [],
      },
    };
    const reader = {
      readGap: vi.fn(async () => ({
        release: activeRelease,
        revision: candidateRevision,
        acceptedRevision,
        candidateRevision,
        findings: [finding(newRequirementId, "candidate")],
        acceptedFindings: [finding(oldRequirementId, "accepted")],
        candidateFindings: [finding(newRequirementId, "candidate")],
        answers: {},
        analysisCycle: null,
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
    expect(workflow.comparison[0].title).toBe("New localized title");
    expect("acceptedFindings" in workflow).toBe(false);
    expect("candidateFindings" in workflow).toBe(false);
    expect(releaseReader.getPublished).toHaveBeenCalledOnce();
    expect(releaseReader.getPublished).toHaveBeenCalledWith({
      releaseId: "release-old",
      locale: "en",
    });
  });
});
