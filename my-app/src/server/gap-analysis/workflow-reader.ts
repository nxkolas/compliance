import { db } from "@/src/db";
import {
  generatedArtifactRevisions,
  generatedArtifacts,
} from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { requireOrganizationCapability } from "../auth/capability-service";
import {
  gapPageReader,
  type GapPageReadInput,
  type GapPageReader,
} from "./page-reader";
import {
  loadActiveGapAnalysisReleasePointer,
  type GapReleaseReader,
  type LoadedGapRelease,
} from "./release-loader";
import { getGapRevisionStalenessBatchPreauthorized } from "./staleness";
import {
  compareGapFindings,
  countGapStatuses,
  deriveGapLifecycleCapabilities,
  deriveGapLifecycleMode,
} from "./workflow-state";
import { loadGapAnalysisRelease } from "./release-loader";
import { localizeGapFinding } from "./finding-localization";
import { nextCachedGapReleaseReader } from "./next-cached-release-loader";
import { readGapRevisionMetadata } from "./gap-revision-metadata";
import {
  projectGapFindingSources,
  type GapFindingSourceEvidence,
} from "./finding-source-projection";
import { loadFindingsForRevisionIds } from "./postgres-page-data";

export async function getGapAnalysisWorkflow(
  input: GapPageReadInput,
  reader: Pick<GapPageReader, "readGap"> = gapPageReader,
  releaseReader: Pick<GapReleaseReader, "getPublished"> =
    nextCachedGapReleaseReader,
) {
  const workflow = await reader.readGap(input);
  const metadata = (result: unknown | undefined) =>
    result === undefined ? null : readGapRevisionMetadata(result);
  const currentMetadata = metadata(workflow.revision?.result);
  const acceptedMetadata = metadata(workflow.acceptedRevision?.result);
  const candidateMetadata = metadata(workflow.candidateRevision?.result);
  const currentCorrectedIds = new Set(currentMetadata?.correctedRequirementVersionIds ?? []);
  const acceptedCorrectedIds = new Set(acceptedMetadata?.correctedRequirementVersionIds ?? []);
  const candidateCorrectedIds = new Set(candidateMetadata?.correctedRequirementVersionIds ?? []);
  const releasePromiseById = new Map<
    string,
    Promise<LoadedGapRelease | null>
  >();
  if (workflow.release) {
    releasePromiseById.set(
      workflow.release.id,
      Promise.resolve(workflow.release),
    );
  }
  const loadPinnedCatalogue = async (
    revision: typeof workflow.revision,
    label: string,
  ) => {
    if (!revision) return new Map();
    if (!revision.gapAnalysisReleaseId) {
      throw new Error(`${label} Gap revision ${revision.id} has no pinned release`);
    }
    let releasePromise = releasePromiseById.get(
      revision.gapAnalysisReleaseId,
    );
    if (!releasePromise) {
      releasePromise = releaseReader.getPublished({
        releaseId: revision.gapAnalysisReleaseId,
        locale: input.locale,
      });
      releasePromiseById.set(revision.gapAnalysisReleaseId, releasePromise);
    }
    const release = await releasePromise;
    if (!release) {
      throw new Error(
        `${label} pinned Gap release ${revision.gapAnalysisReleaseId} is unavailable`,
      );
    }
    return new Map(
      release.requirements.map((requirement) => [
        requirement.id,
        requirement,
      ]),
    );
  };
  const [currentCatalogue, acceptedCatalogue, candidateCatalogue] =
    await Promise.all([
      loadPinnedCatalogue(workflow.revision, "Current"),
      loadPinnedCatalogue(workflow.acceptedRevision, "Accepted"),
      loadPinnedCatalogue(workflow.candidateRevision, "Candidate"),
    ]);
  const enrich = <T extends (typeof workflow.findings)[number]>(
    row: T,
    manuallyChangedIds: Set<string>,
    metadataRows: Array<{
      requirementVersionId: string;
      contradictions: string[];
      questionnaireDisagreements: string[];
    }>,
    catalogueByVersionId: Map<
      string,
      NonNullable<typeof workflow.release>["requirements"][number]
    >,
  ) => {
    const localizedRow = localizeGapFinding(row, catalogueByVersionId);
    const metadata = metadataRows.find(
      (item) =>
        item.requirementVersionId === row.finding.requirementVersionId,
    );
    const contradictions = Array.isArray(metadata?.contradictions)
      ? metadata.contradictions.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const questionnaireDisagreements =
      !manuallyChangedIds.has(row.finding.requirementVersionId) &&
      Array.isArray(metadata?.questionnaireDisagreements)
        ? metadata.questionnaireDisagreements.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
    return {
      ...localizedRow,
      hasOrganizationDocument: row.evidence.some(
        (evidence) => evidence.sourceType === "document_chunk",
      ),
      manuallyChanged: manuallyChangedIds.has(
        row.finding.requirementVersionId,
      ),
      contradictions,
      questionnaireDisagreements,
      sources: projectGapFindingSources({
        organizationId: input.organizationId,
        locale: input.locale,
        evidence: row.evidence as GapFindingSourceEvidence[],
      }),
    };
  };
  const findings = workflow.findings.map((row) =>
    enrich(row, currentCorrectedIds, currentMetadata?.findingDiagnostics ?? [], currentCatalogue),
  );
  const acceptedFindings = workflow.acceptedFindings.map((row) =>
    enrich(row, acceptedCorrectedIds, acceptedMetadata?.findingDiagnostics ?? [], acceptedCatalogue),
  );
  const candidateFindings = workflow.candidateFindings.map((row) =>
    enrich(row, candidateCorrectedIds, candidateMetadata?.findingDiagnostics ?? [], candidateCatalogue),
  );
  const selectedDocumentVersionIds =
    workflow.reassessment?.selected.map(
      (selection) => selection.documentVersionId,
    ) ?? [];
  const selectedDocuments = workflow.documentLibrary.documents.flatMap(
    (entry) => {
      const selected = entry.versions.find((item) =>
        selectedDocumentVersionIds.includes(item.version.id),
      );
      return selected
        ? [
            {
              documentId: entry.document.id,
              title: entry.document.title,
              documentVersionId: selected.version.id,
              fileName: selected.version.fileName,
              eligibleForAnalysis: selected.eligibleForReassessment,
            },
          ]
        : [];
    },
  );
  const answerSummary = workflow.release
    ? workflow.release.questions.map((question) => {
        const option = question.options.find(
          (candidate) => candidate.id === workflow.answers[question.id],
        );
        return {
          questionId: question.id,
          question: question.questionText,
          optionId: option?.id ?? null,
          answer: option?.label ?? null,
          required: question.required,
        };
      })
    : [];
  const lifecycleMode = deriveGapLifecycleMode({
    hasGeneratedRevision: Boolean(workflow.revision),
    hasActiveActionPlan: Boolean(workflow.activePlan),
    generationActive:
      !workflow.revision &&
      (workflow.reassessment?.draft.status === "locked" ||
        workflow.run?.status === "pending" ||
        workflow.run?.status === "processing"),
  });
  const comparison =
    workflow.candidateRevision && workflow.acceptedRevision
      ? compareGapFindings(acceptedFindings, candidateFindings)
      : [];
  const projectedFindings = findings.map(projectCustomerFinding);

  return {
    role: workflow.role,
    canContribute: workflow.canContribute,
    canManage: workflow.canManage,
    release: workflow.release
      ? {
          id: workflow.release.id,
          versionLabel: workflow.release.versionLabel,
          questions: workflow.release.questions,
          requirements: workflow.release.requirements.map((requirement) => ({
            id: requirement.id,
          })),
        }
      : null,
    assessment: workflow.assessment
      ? {
          id: workflow.assessment.id,
          currentRevisionId: workflow.assessment.currentRevisionId,
        }
      : null,
    answers: workflow.answers,
    documentLibrary: projectDocumentLibrary(workflow.documentLibrary),
    run: workflow.run ? { errorCode: workflow.run.errorCode } : null,
    revision: projectRevisionIdentity(workflow.revision),
    acceptedRevision: projectRevisionIdentity(workflow.acceptedRevision),
    candidateRevision: projectRevisionIdentity(workflow.candidateRevision),
    activePlan: workflow.activePlan
      ? {
          sourceGapArtifactRevisionId:
            workflow.activePlan.sourceGapArtifactRevisionId,
        }
      : null,
    reassessment: workflow.reassessment
      ? {
          draft: {
            id: workflow.reassessment.draft.id,
            status: workflow.reassessment.draft.status,
            outputLocale: workflow.reassessment.draft.outputLocale,
            generationJobId:
              workflow.reassessment.draft.generationJobId,
            lockVersion: workflow.reassessment.draft.lockVersion,
          },
          selected: workflow.reassessment.selected.map((selection) => ({
            documentId: selection.documentId,
            documentVersionId: selection.documentVersionId,
          })),
          summary: {
            baseAcceptedGapRevisionNumber:
              workflow.reassessment.summary.baseAcceptedGapRevisionNumber,
            assessmentRevisionNumber:
              workflow.reassessment.summary.assessmentRevisionNumber,
            requirementCount: workflow.reassessment.summary.requirementCount,
          },
        }
      : null,
    prerequisite: workflow.prerequisite,
    history: workflow.history,
    generatedInputs: workflow.generatedInputs,
    reviewBlockers: workflow.reviewBlockers,
    planUpdateAvailable: workflow.planUpdateAvailable,
    acceptedStaleness: workflow.acceptedStaleness,
    candidateStaleness: workflow.candidateStaleness,
    staleness: workflow.staleness,
    lifecycleMode,
    lifecycle: deriveGapLifecycleCapabilities(lifecycleMode),
    answerSummary,
    selectedDocuments,
    findings: projectedFindings,
    gapCounts: countGapStatuses(projectedFindings),
    comparison,
    lastWorkflowChange: workflow.history[0] ?? null,
  };
}

export async function getGapAnalysisRevision(input: {
  userId: string;
  organizationId: string;
  revisionId: string;
  locale: "de" | "en";
}) {
  const revision = await getGapAnalysisRevisionRecord(input);
  if (!revision) return null;
  if (!revision.gapAnalysisReleaseId) {
    throw new Error(`Gap revision ${revision.id} has no pinned release`);
  }
  const [findings, pinnedRelease, activeRelease] = await Promise.all([
    loadFindings(revision.id),
    loadGapAnalysisRelease(revision.gapAnalysisReleaseId, input.locale),
    loadActiveGapAnalysisReleasePointer("nis2-gap"),
  ]);
  if (!pinnedRelease) {
    throw new Error(
      `Pinned Gap release ${revision.gapAnalysisReleaseId} is unavailable`,
    );
  }
  const catalogueByVersionId = new Map(
    pinnedRelease.requirements.map((requirement) => [
      requirement.id,
      requirement,
    ]),
  );
  const metadata = readGapRevisionMetadata(revision.result);
  const correctedIds = new Set(metadata.correctedRequirementVersionIds);
  const localizedFindings = findings.map((finding) => {
    const localized = localizeGapFinding(
      finding,
      catalogueByVersionId,
      pinnedRelease.id,
    );
    const diagnostics = metadata.findingDiagnostics.find(
      (item) =>
        item.requirementVersionId === finding.finding.requirementVersionId,
    );
    return projectCustomerFinding({
      ...localized,
      hasOrganizationDocument: finding.evidence.some(
        (evidence) => evidence.sourceType === "document_chunk",
      ),
      manuallyChanged: correctedIds.has(
        finding.finding.requirementVersionId,
      ),
      questionnaireDisagreements:
        correctedIds.has(finding.finding.requirementVersionId)
          ? []
          : (diagnostics?.questionnaireDisagreements ?? []),
      sources: projectGapFindingSources({
        organizationId: input.organizationId,
        locale: input.locale,
        evidence: finding.evidence as GapFindingSourceEvidence[],
      }),
    });
  });
  const staleness = (
    await getGapRevisionStalenessBatchPreauthorized({
      organizationId: input.organizationId,
      acceptedRevisionId: revision.id,
      candidateRevisionId: null,
      activeGapReleaseId: activeRelease?.gapAnalysisReleaseId ?? null,
    })
  ).accepted;
  return {
    revision: projectRevisionIdentity(revision),
    findings: localizedFindings,
    staleness,
  };
}

export async function getGapAnalysisRevisionRecord(input: {
  userId: string;
  organizationId: string;
  revisionId: string;
}) {
  await requireOrganizationCapability(
    input.userId,
    input.organizationId,
    "gap:read",
  );
  const [row] = await db
    .select({ revision: generatedArtifactRevisions })
    .from(generatedArtifactRevisions)
    .innerJoin(
      generatedArtifacts,
      eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id),
    )
    .where(
      and(
        eq(generatedArtifactRevisions.id, input.revisionId),
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
      ),
    )
    .limit(1);
  return row?.revision ?? null;
}

async function loadFindings(revisionId: string) {
  return loadFindingsForRevisionIds([revisionId]);
}

function projectCustomerFinding<
  T extends {
    finding: {
      id: string;
      status:
        | "fulfilled"
        | "partially_fulfilled"
        | "not_fulfilled"
        | "insufficient_evidence";
      rationale: string;
      recommendation: string;
      requiresReview: boolean;
    };
    requirement: { title: unknown; position: number };
    hasOrganizationDocument: boolean;
    manuallyChanged: boolean;
    questionnaireDisagreements: string[];
    sources: ReturnType<typeof projectGapFindingSources>;
  },
>(row: T) {
  return {
    finding: {
      id: row.finding.id,
      status: row.finding.status,
      rationale: row.finding.rationale,
      recommendation: row.finding.recommendation,
      requiresReview: row.finding.requiresReview,
    },
    requirement: {
      title: row.requirement.title,
      position: row.requirement.position,
    },
    hasOrganizationDocument: row.hasOrganizationDocument,
    manuallyChanged: row.manuallyChanged,
    hasQuestionnaireDisagreement: row.questionnaireDisagreements.length > 0,
    sources: row.sources,
  };
}

function projectRevisionIdentity<
  T extends { id: string; outputLocale?: string | null } | null,
>(revision: T) {
  return revision
    ? { id: revision.id, outputLocale: revision.outputLocale ?? null }
    : null;
}

function projectDocumentLibrary<
  T extends {
    role: unknown;
    canContribute: boolean;
    nextCursor?: string;
    documents: Array<{
      document: {
        id: string;
        title: string;
        status: string;
        currentVersionId: string | null;
      };
      versions: Array<{
        version: {
          id: string;
          versionNumber: number;
          fileName: string;
          mimeType: string;
          archivedAt: Date | null;
        };
        usage: unknown;
        eligibleForReassessment: boolean;
      }>;
    }>;
  },
>(library: T) {
  return {
    role: library.role,
    canContribute: library.canContribute,
    nextCursor: library.nextCursor,
    documents: library.documents.map((entry) => ({
      document: {
        id: entry.document.id,
        title: entry.document.title,
        status: entry.document.status,
        currentVersionId: entry.document.currentVersionId,
      },
      versions: entry.versions.map((item) => ({
        version: {
          id: item.version.id,
          versionNumber: item.version.versionNumber,
          fileName: item.version.fileName,
          mimeType: item.version.mimeType,
          archivedAt: item.version.archivedAt,
        },
        eligibleForReassessment: item.eligibleForReassessment,
      })),
    })),
  };
}
