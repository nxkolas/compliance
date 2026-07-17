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
import { and, eq } from "drizzle-orm";
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

export async function getGapRevisionStaleness(input: {
  userId: string;
  organizationId: string;
  revisionId: string;
}) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  const revision = await db.query.generatedArtifactRevisions.findFirst({
    where: eq(generatedArtifactRevisions.id, input.revisionId),
  });
  if (!revision?.gapAnalysisReleaseId) throw new ApiError(404, "Gap revision not found");
  const artifact = await db.query.generatedArtifacts.findFirst({
    where: and(
      eq(generatedArtifacts.id, revision.artifactId),
      eq(generatedArtifacts.organizationId, input.organizationId),
    ),
  });
  if (!artifact) throw new ApiError(404, "Gap revision not found");
  const sources = await db.query.artifactRevisionSources.findMany({
    where: eq(artifactRevisionSources.artifactRevisionId, revision.id),
  });
  const dependencies: StalenessDependency[] = [];
  for (const source of sources) {
    if (source.sourceType === "assessment_revision") {
      const assessmentRevision = await db.query.assessmentRevisions.findFirst({
        where: eq(assessmentRevisions.id, source.sourceId),
      });
      const assessment = assessmentRevision
        ? await db.query.assessments.findFirst({
            where: eq(assessments.id, assessmentRevision.assessmentId),
          })
        : null;
      dependencies.push({
        kind: "assessment_revision",
        selectedId: source.sourceId,
        currentId: assessment?.currentRevisionId ?? null,
        archived: assessment?.status === "archived",
      });
    } else if (source.sourceType === "document_version") {
      const version = await db.query.documentVersions.findFirst({
        where: eq(documentVersions.id, source.sourceId),
      });
      const document = version
        ? await db.query.documents.findFirst({
            where: eq(documents.id, version.documentId),
          })
        : null;
      dependencies.push({
        kind: "document_version",
        selectedId: source.sourceId,
        currentId: document?.currentVersionId ?? null,
        archived: Boolean(version?.archivedAt) || document?.status === "archived",
      });
    } else if (source.sourceType === "artifact_revision") {
      const sourceRevision = await db.query.generatedArtifactRevisions.findFirst({
        where: eq(generatedArtifactRevisions.id, source.sourceId),
      });
      const sourceArtifact = sourceRevision
        ? await db.query.generatedArtifacts.findFirst({
            where: eq(generatedArtifacts.id, sourceRevision.artifactId),
          })
        : null;
      dependencies.push({
        kind: "artifact_revision",
        selectedId: source.sourceId,
        currentId: sourceArtifact?.currentRevisionId ?? null,
        archived: sourceRevision?.status === "archived",
      });
    }
  }
  const active = await db.query.activeGapAnalysisReleases.findFirst({
    where: eq(activeGapAnalysisReleases.releaseCode, "nis2-gap"),
  });
  return calculateGapStaleness({
    dependencies,
    pinnedGapReleaseId: revision.gapAnalysisReleaseId,
    activeGapReleaseId: active?.gapAnalysisReleaseId ?? null,
    revisionArchived: revision.status === "archived",
  });
}
