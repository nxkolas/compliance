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

export async function getGapAnalysisWorkflow(input: GapPageReadInput) {
  return gapPageReader.readGap(input);
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
