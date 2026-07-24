import { db } from "@/src/db";
import {
  gapFindingEvidence,
  gapFindings,
  gapRequirementVersions,
  generatedArtifactRevisions,
  generatedArtifacts,
} from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
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

export async function getGapAnalysisWorkflow(
  input: GapPageReadInput,
  reader: Pick<GapPageReader, "readGap"> = gapPageReader,
  releaseReader: Pick<GapReleaseReader, "getPublished"> =
    nextCachedGapReleaseReader,
) {
  const workflow = await reader.readGap(input);
  const correctedIds = (result: unknown) =>
    new Set(
      Array.isArray(
        (result as Record<string, unknown> | undefined)
          ?.correctedRequirementVersionIds,
      )
        ? ((result as Record<string, unknown>)
            .correctedRequirementVersionIds as unknown[]).filter(
          (value): value is string => typeof value === "string",
        )
        : [],
    );
  const findingMetadata = (result: unknown) => {
    const rows = Array.isArray(
      (result as Record<string, unknown> | undefined)?.findings,
    )
      ? ((result as Record<string, unknown>).findings as Array<
          Record<string, unknown>
        >)
      : [];
    return rows;
  };
  const currentCorrectedIds = correctedIds(workflow.revision?.result);
  const acceptedCorrectedIds = correctedIds(workflow.acceptedRevision?.result);
  const candidateCorrectedIds = correctedIds(workflow.candidateRevision?.result);
  const currentMetadata = findingMetadata(workflow.revision?.result);
  const acceptedMetadata = findingMetadata(workflow.acceptedRevision?.result);
  const candidateMetadata = findingMetadata(workflow.candidateRevision?.result);
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
    metadataRows: Array<Record<string, unknown>>,
    catalogueByVersionId: Map<
      string,
      NonNullable<typeof workflow.release>["requirements"][number]
    >,
  ) => {
    const localizedRow = localizeGapFinding(row, catalogueByVersionId);
    const metadata = metadataRows.find(
      (item) =>
        item.requirementVersionId === row.finding.requirementVersionId ||
        item.requirementCode === row.requirement.code,
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
    };
  };
  const findings = workflow.findings.map((row) =>
    enrich(row, currentCorrectedIds, currentMetadata, currentCatalogue),
  );
  const acceptedFindings = workflow.acceptedFindings.map((row) =>
    enrich(row, acceptedCorrectedIds, acceptedMetadata, acceptedCatalogue),
  );
  const candidateFindings = workflow.candidateFindings.map((row) =>
    enrich(row, candidateCorrectedIds, candidateMetadata, candidateCatalogue),
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

  return {
    ...workflow,
    lifecycleMode,
    lifecycle: deriveGapLifecycleCapabilities(lifecycleMode),
    answerSummary,
    selectedDocuments,
    findings,
    acceptedFindings,
    candidateFindings,
    gapCounts: countGapStatuses(findings),
    comparison:
      workflow.candidateRevision && workflow.acceptedRevision
        ? compareGapFindings(acceptedFindings, candidateFindings)
        : [],
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
  const localizedFindings = findings.map((finding) =>
    localizeGapFinding(finding, catalogueByVersionId, pinnedRelease.id),
  );
  const staleness = (
    await getGapRevisionStalenessBatchPreauthorized({
      organizationId: input.organizationId,
      acceptedRevisionId: revision.id,
      candidateRevisionId: null,
      activeGapReleaseId: activeRelease?.gapAnalysisReleaseId ?? null,
    })
  ).accepted;
  return { revision, findings: localizedFindings, staleness };
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
  const findingRows = await db
    .select({ finding: gapFindings, requirement: gapRequirementVersions })
    .from(gapFindings)
    .innerJoin(
      gapRequirementVersions,
      eq(gapFindings.requirementVersionId, gapRequirementVersions.id),
    )
    .where(eq(gapFindings.artifactRevisionId, revisionId));
  const evidenceRows = findingRows.length
    ? await db.query.gapFindingEvidence.findMany({
        where: inArray(
          gapFindingEvidence.findingId,
          findingRows.map((row) => row.finding.id),
        ),
      })
    : [];
  return findingRows.map((row) => ({
    ...row,
    evidence: evidenceRows.filter(
      (evidence) => evidence.findingId === row.finding.id,
    ),
  }));
}
