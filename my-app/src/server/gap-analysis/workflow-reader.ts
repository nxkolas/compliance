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
import { gapPageReader, type GapPageReadInput } from "./page-reader";
import { loadActiveGapAnalysisReleasePointer } from "./release-loader";
import { getGapRevisionStalenessBatchPreauthorized } from "./staleness";
import { loadGapHistoryPreauthorized } from "./history-reader";
import { postgresGapPageData } from "./postgres-page-data";
import {
  compareGapFindings,
  countGapStatuses,
  deriveGapLifecycleCapabilities,
  deriveGapLifecycleMode,
} from "./workflow-state";
import { readGeneratedGapInputs } from "./generated-inputs-reader";

export async function getGapAnalysisWorkflow(input: GapPageReadInput) {
  const workflow = await gapPageReader.readGap(input);
  const [prerequisite, history, generatedInputs] = await Promise.all([
    workflow.release
      ? postgresGapPageData.loadGapPrerequisiteState(input, workflow.release)
      : Promise.resolve({
          satisfied: false,
          destination: `/tool/organizations/${input.organizationId}/applicability-check`,
        }),
    workflow.release
      ? loadGapHistoryPreauthorized({
          organizationId: input.organizationId,
          currentUserId: input.userId,
          locale: input.locale,
        })
      : Promise.resolve([]),
    workflow.revision
      ? readGeneratedGapInputs({
          organizationId: input.organizationId,
          revisionId: workflow.revision.id,
          locale: input.locale,
        })
      : Promise.resolve(null),
  ]);
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
  const catalogueByVersionId = new Map(
    workflow.release?.requirements.map((requirement) => [
      requirement.id,
      requirement,
    ]) ?? [],
  );
  const enrich = <T extends (typeof workflow.findings)[number]>(
    row: T,
    manuallyChangedIds: Set<string>,
    metadataRows: Array<Record<string, unknown>>,
  ) => {
    const catalogue = catalogueByVersionId.get(
      row.finding.requirementVersionId,
    );
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
      ...row,
      requirement: {
        ...row.requirement,
        stableRequirementId:
          catalogue?.stableRequirementId ?? row.requirement.requirementId,
        position: catalogue?.position ?? Number.MAX_SAFE_INTEGER,
      },
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
    enrich(row, currentCorrectedIds, currentMetadata),
  );
  const acceptedFindings = workflow.acceptedFindings.map((row) =>
    enrich(row, acceptedCorrectedIds, acceptedMetadata),
  );
  const candidateFindings = workflow.candidateFindings.map((row) =>
    enrich(row, candidateCorrectedIds, candidateMetadata),
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
    prerequisite,
    lifecycleMode,
    lifecycle: deriveGapLifecycleCapabilities(lifecycleMode),
    generatedInputs,
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
    history,
    lastWorkflowChange: history[0] ?? null,
  };
}

export async function getGapAnalysisRevision(input: {
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
  if (!row) return null;
  const [findings, activeRelease] = await Promise.all([
    loadFindings(row.revision.id),
    loadActiveGapAnalysisReleasePointer("nis2-gap"),
  ]);
  const staleness = (
    await getGapRevisionStalenessBatchPreauthorized({
      organizationId: input.organizationId,
      acceptedRevisionId: row.revision.id,
      candidateRevisionId: null,
      activeGapReleaseId: activeRelease?.gapAnalysisReleaseId ?? null,
    })
  ).accepted;
  return { revision: row.revision, findings, staleness };
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
