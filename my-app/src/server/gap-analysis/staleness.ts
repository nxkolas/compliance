import { db } from "@/src/db";
import { artifactRevisionArtifactSources, artifactRevisionAssessmentSources, artifactRevisionDocumentSources, assessmentRevisions, assessments, documentVersions, documents, generatedArtifactRevisions, generatedArtifacts } from "@/src/db/schema";
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
  const active = await db.query.activeGapAnalysisReleases.findFirst({ columns: { releaseCode: true, gapAnalysisReleaseId: true, activatedBy: true, activatedAt: true },
    where: { RAW: (table, operators) => (eq(table.releaseCode, "nis2-gap")) ?? operators.sql`true` },
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
      assessmentSourceId: artifactRevisionAssessmentSources.assessmentRevisionId,
      documentSourceId: artifactRevisionDocumentSources.documentVersionId,
      artifactSourceId: artifactRevisionArtifactSources.sourceArtifactRevisionId,
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
      artifactRevisionAssessmentSources,
      eq(
        artifactRevisionAssessmentSources.artifactRevisionId,
        generatedArtifactRevisions.id,
      ),
    )
    .leftJoin(
      sourceAssessmentRevision,
      eq(sourceAssessmentRevision.id, artifactRevisionAssessmentSources.assessmentRevisionId),
    )
    .leftJoin(
      sourceAssessment,
      eq(sourceAssessment.id, sourceAssessmentRevision.assessmentId),
    )
    .leftJoin(
      artifactRevisionDocumentSources,
      eq(artifactRevisionDocumentSources.artifactRevisionId, generatedArtifactRevisions.id),
    )
    .leftJoin(
      sourceDocumentVersion,
      eq(sourceDocumentVersion.id, artifactRevisionDocumentSources.documentVersionId),
    )
    .leftJoin(
      sourceDocument,
      eq(sourceDocument.id, sourceDocumentVersion.documentId),
    )
    .leftJoin(
      artifactRevisionArtifactSources,
      eq(artifactRevisionArtifactSources.artifactRevisionId, generatedArtifactRevisions.id),
    )
    .leftJoin(
      sourceArtifactRevision,
      eq(sourceArtifactRevision.id, artifactRevisionArtifactSources.sourceArtifactRevisionId),
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
        row.assessmentSourceId &&
        row.assessmentOrganizationId &&
        row.assessmentOrganizationId !== input.organizationId
      ) {
        throw new ApiError(404, "Gap revision source not found");
      }
      if (
        row.documentSourceId &&
        row.documentOrganizationId &&
        row.documentOrganizationId !== input.organizationId
      ) {
        throw new ApiError(404, "Gap revision source not found");
      }
      if (
        row.artifactSourceId &&
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
    const duplicateDependencies = revisionRows.flatMap(
      (row): StalenessDependency[] => {
        const dependencies: StalenessDependency[] = [];
        if (row.assessmentSourceId) {
          dependencies.push({
            kind: "assessment_revision",
            selectedId: row.assessmentSourceId,
            currentId: row.assessmentCurrentRevisionId,
            archived: row.assessmentStatus === "archived",
          });
        }
        if (row.documentSourceId) {
          dependencies.push({
            kind: "document_version",
            selectedId: row.documentSourceId,
            currentId: row.documentCurrentVersionId,
            archived:
              Boolean(row.documentVersionArchivedAt) ||
              row.documentStatus === "archived",
          });
        }
        if (row.artifactSourceId) {
          dependencies.push({
            kind: "artifact_revision",
            selectedId: row.artifactSourceId,
            currentId: row.sourceArtifactCurrentRevisionId,
            archived: row.sourceArtifactRevisionStatus === "archived",
          });
        }
        return dependencies;
      },
    );
    const dependencies = [...new Map(
      duplicateDependencies.map((dependency) => [
        `${dependency.kind}:${dependency.selectedId}`,
        dependency,
      ]),
    ).values()];
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
