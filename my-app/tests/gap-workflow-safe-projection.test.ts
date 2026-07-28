import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/db", () => ({ db: {} }));

import { getGapAnalysisWorkflow } from "@/src/server/gap-analysis/workflow-reader";
import type { LoadedGapRelease } from "@/src/server/gap-analysis/release-loader";

const requirementVersionId = "00000000-0000-4000-8000-000000000100";

function metadata(diagnostic: {
  contradictions: string[];
  questionnaireDisagreements: string[];
}) {
  return {
    schemaKind: "gap_revision_metadata_v1" as const,
    outputLocale: "en" as const,
    findingDiagnostics: [
      {
        requirementVersionId,
        ...diagnostic,
      },
    ],
    correctedFromRevisionId: null,
    correctedRequirementVersionIds: [],
  };
}

function rawFinding(revisionId: string, suffix: string) {
  return {
    finding: {
      id: `finding-${suffix}`,
      artifactRevisionId: revisionId,
      requirementVersionId,
      status: "not_fulfilled" as const,
      evidenceSufficiency: "insufficient" as const,
      severity: "high" as const,
      rationale: "Customer-safe rationale",
      recommendation: "Customer-safe recommendation",
      assumptions: [`ASSUMPTION_SENTINEL_${suffix}`],
      requiresReview: true,
      createdAt: new Date(),
    },
    requirement: {
      id: requirementVersionId,
      requirementId: "raw-requirement",
      versionLabel: "v1",
      criticality: "high" as const,
      titleContentRevisionId: "title-revision",
      requirementTextContentRevisionId: "text-revision",
      legalReferences: [],
      contentHash: `CONTENT_HASH_SENTINEL_${suffix}`,
      createdAt: new Date(),
      code: `REQUIREMENT_CODE_SENTINEL_${suffix}`,
    },
    evidence: [
      {
        id: `evidence-assessment-${suffix}`,
        findingId: `finding-${suffix}`,
        citationId: `CITATION_ID_SENTINEL_${suffix}`,
        sourceType: "assessment_answer" as const,
        assessmentAnswerId: "answer-id",
        documentChunkId: null,
        legalSourceChunkId: null,
        excerpt: `EXCERPT_SENTINEL_${suffix}`,
        pageNumber: null,
        sectionLabel: null,
        createdAt: new Date(),
        documentSource: null,
        legalSource: null,
      },
      {
        id: `evidence-document-${suffix}`,
        findingId: `finding-${suffix}`,
        citationId: `DOCUMENT_CITATION_SENTINEL_${suffix}`,
        sourceType: "document_chunk" as const,
        assessmentAnswerId: null,
        documentChunkId: "document-chunk",
        legalSourceChunkId: null,
        excerpt: `DOCUMENT_EXCERPT_SENTINEL_${suffix}`,
        pageNumber: 4,
        sectionLabel: "Policy scope",
        createdAt: new Date(),
        documentSource: {
          versionId: "00000000-0000-4000-8000-000000000200",
          documentId: "00000000-0000-4000-8000-000000000201",
          title: "Security policy",
          mimeType: "application/pdf",
          chunkPageNumber: 1,
          chunkSectionLabel: "Fallback",
        },
        legalSource: null,
      },
      {
        id: `evidence-legal-${suffix}`,
        findingId: `finding-${suffix}`,
        citationId: `LEGAL_CITATION_SENTINEL_${suffix}`,
        sourceType: "legal_source_chunk" as const,
        assessmentAnswerId: null,
        documentChunkId: null,
        legalSourceChunkId: "legal-chunk",
        excerpt: `LEGAL_EXCERPT_SENTINEL_${suffix}`,
        pageNumber: 9,
        sectionLabel: "Article 21",
        createdAt: new Date(),
        documentSource: null,
        legalSource: {
          versionId: "00000000-0000-4000-8000-000000000300",
          title: "NIS2 Directive",
          upstreamUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/",
          mimeType: "text/html",
          chunkPageNumber: null,
          chunkSectionLabel: null,
        },
      },
    ],
  };
}

describe("customer-safe Gap workflow projection", () => {
  it("returns compact sources without raw findings or audit-only values", async () => {
    const release: LoadedGapRelease = {
      id: "release",
      releaseCode: "nis2-gap",
      versionLabel: "2026.1",
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
        templateHash: "PROMPT_HASH_SENTINEL",
        responseSchemaVersion: "1",
      },
      actionPlanPrompt: {
        name: "action-plan",
        version: "1",
        templateHash: "ACTION_PROMPT_HASH_SENTINEL",
        responseSchemaVersion: "1",
      },
      evaluator: { kind: "deterministic", version: 1 },
      questions: [],
      requirements: [
        {
          id: requirementVersionId,
          stableRequirementId: "stable-requirement",
          code: "REQUIREMENT_CODE_SENTINEL_CATALOGUE",
          position: 1,
          criticality: "high",
          title: "Access control",
          requirementText: "REQUIREMENT_TEXT_SENTINEL",
          legalReferences: [],
          applicabilityOutcomeCodes: ["essential_entity"],
          questionStableKeys: [],
        },
      ],
    };
    const acceptedRevision = {
      id: "accepted",
      gapAnalysisReleaseId: release.id,
      outputLocale: "en",
      result: metadata({
        contradictions: ["CONTRADICTION_SENTINEL_ACCEPTED"],
        questionnaireDisagreements: [],
      }),
      modelName: "MODEL_SENTINEL_ACCEPTED",
    };
    const candidateRevision = {
      id: "candidate",
      gapAnalysisReleaseId: release.id,
      outputLocale: "en",
      result: metadata({
        contradictions: ["CONTRADICTION_SENTINEL_CANDIDATE"],
        questionnaireDisagreements: ["QUESTIONNAIRE_DIAGNOSTIC_SENTINEL"],
      }),
      modelName: "MODEL_SENTINEL_CANDIDATE",
    };
    const reader = {
      readGap: vi.fn(async () => ({
        role: "owner",
        canContribute: true,
        canManage: true,
        release,
        assessment: null,
        answers: {},
        documents: [],
        documentLibrary: {
          role: "owner",
          canContribute: true,
          documents: [
            {
              document: {
                id: "document",
                title: "Security policy",
                status: "active",
                currentVersionId:
                  "00000000-0000-4000-8000-000000000200",
              },
              versions: [
                {
                  version: {
                    id: "00000000-0000-4000-8000-000000000200",
                    versionNumber: 1,
                    fileName: "policy.pdf",
                    mimeType: "application/pdf",
                    archivedAt: null,
                    storageBucket: "BUCKET_SENTINEL",
                    storagePath: "STORAGE_PATH_SENTINEL",
                    contentHash: "DOCUMENT_HASH_SENTINEL",
                  },
                  usage: [],
                  eligibleForReassessment: true,
                },
              ],
            },
          ],
        },
        run: null,
        revision: candidateRevision,
        findings: [rawFinding("candidate", "CURRENT")],
        acceptedRevision,
        acceptedFindings: [rawFinding("accepted", "ACCEPTED")],
        candidateRevision,
        candidateFindings: [rawFinding("candidate", "CANDIDATE")],
        activePlan: null,
        reassessment: null,
        prerequisite: {
          satisfied: true,
          status: "eligible",
          destination: "/applicability",
          rawStoredResult: "PREREQUISITE_RAW_RESULT_SENTINEL",
        },
        history: [],
        generatedInputs: null,
        reviewBlockers: ["finding-CANDIDATE"],
        planUpdateAvailable: false,
        acceptedStaleness: null,
        candidateStaleness: null,
        staleness: null,
      })),
    };

    const workflow = await getGapAnalysisWorkflow(
      {
        userId: "user",
        organizationId: "00000000-0000-4000-8000-000000000001",
        locale: "en",
      },
      reader as never,
    );
    const serialized = JSON.stringify(workflow);

    expect(workflow.findings[0]?.sources.map((source) => source.kind)).toEqual([
      "assessment",
      "document",
      "legal",
    ]);
    expect(workflow.findings[0]).toMatchObject({
      hasOrganizationDocument: true,
      hasQuestionnaireDisagreement: true,
      requirement: { title: "Access control", position: 1 },
    });
    expect("acceptedFindings" in workflow).toBe(false);
    expect("candidateFindings" in workflow).toBe(false);
    for (const sentinel of [
      "ASSUMPTION_SENTINEL",
      "CITATION_ID_SENTINEL",
      "EXCERPT_SENTINEL",
      "CONTRADICTION_SENTINEL",
      "QUESTIONNAIRE_DIAGNOSTIC_SENTINEL",
      "REQUIREMENT_CODE_SENTINEL",
      "REQUIREMENT_TEXT_SENTINEL",
      "CONTENT_HASH_SENTINEL",
      "PROMPT_HASH_SENTINEL",
      "MODEL_SENTINEL",
      "PREREQUISITE_RAW_RESULT_SENTINEL",
      "BUCKET_SENTINEL",
      "STORAGE_PATH_SENTINEL",
      "DOCUMENT_HASH_SENTINEL",
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });
});
