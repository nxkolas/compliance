import { db } from "@/src/db";
import {
  activeGapAnalysisReleases,
  artifactRevisionSources,
  assessmentRevisions,
  assessments,
  documentVersions,
  documents,
  generatedArtifactRevisions,
  generatedArtifacts,
} from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ApiError } from "../api/errors";
import { assertCanAccessOrganization } from "../organizations/service";

export type StalenessDependency = {
  kind: "assessment_revision" | "document_version" | "artifact_revision";
  selectedId: string;
  currentId: string | null;
  archived?: boolean;
};

export function calculateGapStaleness(input: {
  dependencies: StalenessDependency[];
  pinnedGapReleaseId: string;
  activeGapReleaseId: string | null;
  revisionArchived: boolean;
}) {
  const staleDependencies = input.dependencies.filter(
    (dependency) =>
      dependency.archived || dependency.currentId !== dependency.selectedId,
  );
  return {
    stale: staleDependencies.length > 0,
    outdatedRelease:
      Boolean(input.activeGapReleaseId) &&
      input.activeGapReleaseId !== input.pinnedGapReleaseId,
    archived: input.revisionArchived,
    staleDependencies,
  };
}

export type GapRevisionStaleness = ReturnType<typeof calculateGapStaleness>;

export async function getGapRevisionStaleness(input: {
  userId: string;
  organizationId: string;
  revisionId: string;
}) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  const active = await db.query.activeGapAnalysisReleases.findFirst({
    where: eq(activeGapAnalysisReleases.releaseCode, "nis2-gap"),
  });
  const batch = await getGapRevisionStalenessBatchPreauthorized({
    organizationId: input.organizationId,
    acceptedRevisionId: input.revisionId,
    candidateRevisionId: null,
    activeGapReleaseId: active?.gapAnalysisReleaseId ?? null,
  });
  if (!batch.accepted) throw new ApiError(404, "Gap revision not found");
  return batch.accepted;
}

export async function getGapRevisionStalenessBatchPreauthorized(input: {
  organizationId: string;
  acceptedRevisionId: string | null;
  candidateRevisionId: string | null;
  activeGapReleaseId: string | null;
}) {
  const revisionIds = [
    ...new Set(
      [input.acceptedRevisionId, input.candidateRevisionId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
  if (!revisionIds.length) {
    return { accepted: null, candidate: null };
  }

  const sourceAssessmentRevision = alias(
    assessmentRevisions,
    "staleness_assessment_revision",
  );
  const sourceAssessment = alias(assessments, "staleness_assessment");
  const sourceDocumentVersion = alias(
    documentVersions,
    "staleness_document_version",
  );
  const sourceDocument = alias(documents, "staleness_document");
  const sourceArtifactRevision = alias(
    generatedArtifactRevisions,
    "staleness_artifact_revision",
  );
  const sourceArtifact = alias(
    generatedArtifacts,
    "staleness_artifact",
  );

  const rows = await db
    .select({
      revision: generatedArtifactRevisions,
      artifactOrganizationId: generatedArtifacts.organizationId,
      sourceType: artifactRevisionSources.sourceType,
      sourceId: artifactRevisionSources.sourceId,
      assessmentId: sourceAssessment.id,
      assessmentOrganizationId: sourceAssessment.organizationId,
      assessmentCurrentRevisionId: sourceAssessment.currentRevisionId,
      assessmentStatus: sourceAssessment.status,
      documentId: sourceDocument.id,
      documentOrganizationId: sourceDocument.organizationId,
      documentCurrentVersionId: sourceDocument.currentVersionId,
      documentStatus: sourceDocument.status,
      documentVersionArchivedAt: sourceDocumentVersion.archivedAt,
      sourceArtifactRevisionId: sourceArtifactRevision.id,
      sourceArtifactRevisionStatus: sourceArtifactRevision.status,
      sourceArtifactId: sourceArtifact.id,
      sourceArtifactOrganizationId: sourceArtifact.organizationId,
      sourceArtifactCurrentRevisionId: sourceArtifact.currentRevisionId,
    })
    .from(generatedArtifactRevisions)
    .innerJoin(
      generatedArtifacts,
      eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id),
    )
    .leftJoin(
      artifactRevisionSources,
      eq(
        artifactRevisionSources.artifactRevisionId,
        generatedArtifactRevisions.id,
      ),
    )
    .leftJoin(
      sourceAssessmentRevision,
      and(
        eq(artifactRevisionSources.sourceType, "assessment_revision"),
        eq(sourceAssessmentRevision.id, artifactRevisionSources.sourceId),
      ),
    )
    .leftJoin(
      sourceAssessment,
      eq(sourceAssessment.id, sourceAssessmentRevision.assessmentId),
    )
    .leftJoin(
      sourceDocumentVersion,
      and(
        eq(artifactRevisionSources.sourceType, "document_version"),
        eq(sourceDocumentVersion.id, artifactRevisionSources.sourceId),
      ),
    )
    .leftJoin(
      sourceDocument,
      eq(sourceDocument.id, sourceDocumentVersion.documentId),
    )
    .leftJoin(
      sourceArtifactRevision,
      and(
        eq(artifactRevisionSources.sourceType, "artifact_revision"),
        eq(sourceArtifactRevision.id, artifactRevisionSources.sourceId),
      ),
    )
    .leftJoin(
      sourceArtifact,
      eq(sourceArtifact.id, sourceArtifactRevision.artifactId),
    )
    .where(
      and(
        inArray(generatedArtifactRevisions.id, revisionIds),
        eq(generatedArtifacts.organizationId, input.organizationId),
      ),
    );

  const rowsByRevision = new Map<
    string,
    typeof rows
  >();
  for (const row of rows) {
    const revisionRows = rowsByRevision.get(row.revision.id) ?? [];
    revisionRows.push(row);
    rowsByRevision.set(row.revision.id, revisionRows);
  }

  for (const revisionId of revisionIds) {
    const revisionRows = rowsByRevision.get(revisionId);
    const revision = revisionRows?.[0]?.revision;
    if (!revisionRows || !revision?.gapAnalysisReleaseId) {
      throw new ApiError(404, "Gap revision not found");
    }
    for (const row of revisionRows) {
      if (
        row.sourceType === "assessment_revision" &&
        row.assessmentOrganizationId &&
        row.assessmentOrganizationId !== input.organizationId
      ) {
        throw new ApiError(404, "Gap revision source not found");
      }
      if (
        row.sourceType === "document_version" &&
        row.documentOrganizationId &&
        row.documentOrganizationId !== input.organizationId
      ) {
        throw new ApiError(404, "Gap revision source not found");
      }
      if (
        row.sourceType === "artifact_revision" &&
        row.sourceArtifactOrganizationId &&
        row.sourceArtifactOrganizationId !== input.organizationId
      ) {
        throw new ApiError(404, "Gap revision source not found");
      }
    }
  }

  const calculate = (revisionId: string | null) => {
    if (!revisionId) return null;
    const revisionRows = rowsByRevision.get(revisionId)!;
    const revision = revisionRows[0].revision;
    const dependencies = revisionRows.flatMap(
      (row): StalenessDependency[] => {
        if (!row.sourceType || !row.sourceId) return [];
        if (row.sourceType === "assessment_revision") {
          return [{
            kind: "assessment_revision",
            selectedId: row.sourceId,
            currentId: row.assessmentCurrentRevisionId,
            archived: row.assessmentStatus === "archived",
          }];
        }
        if (row.sourceType === "document_version") {
          return [{
            kind: "document_version",
            selectedId: row.sourceId,
            currentId: row.documentCurrentVersionId,
            archived:
              Boolean(row.documentVersionArchivedAt) ||
              row.documentStatus === "archived",
          }];
        }
        return [{
          kind: "artifact_revision",
          selectedId: row.sourceId,
          currentId: row.sourceArtifactCurrentRevisionId,
          archived: row.sourceArtifactRevisionStatus === "archived",
        }];
      },
    );
    return calculateGapStaleness({
      dependencies,
      pinnedGapReleaseId: revision.gapAnalysisReleaseId!,
      activeGapReleaseId: input.activeGapReleaseId,
      revisionArchived: revision.status === "archived",
    });
  };

  return {
    accepted: calculate(input.acceptedRevisionId),
    candidate: calculate(input.candidateRevisionId),
  };
}
