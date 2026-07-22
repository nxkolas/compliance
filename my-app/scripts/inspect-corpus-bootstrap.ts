import "dotenv/config";

import { closeDbConnection, db } from "@/src/db";
import {
  backgroundJobs,
  legalCorpusFamilies,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      familyCode: legalCorpusFamilies.code,
      sourceCode: legalSources.stableCode,
      versionId: legalSourceVersions.id,
      versionLabel: legalSourceVersions.versionLabel,
      versionStatus: legalSourceVersions.status,
      contentHash: legalSourceVersions.contentHash,
      renditionId: legalSourceRenditions.id,
      generationId: legalSourceProcessingGenerations.id,
      generationState: legalSourceProcessingGenerations.state,
      reliableAnchors: legalSourceProcessingGenerations.reliableAnchors,
      normalizedTextHash: legalSourceProcessingGenerations.normalizedTextHash,
      qualityMetrics: legalSourceProcessingGenerations.qualityMetrics,
      processJobState: backgroundJobs.state,
      embeddingJobId: legalSourceProcessingGenerations.embeddingJobId,
    })
    .from(legalCorpusFamilies)
    .innerJoin(legalSources, eq(legalSources.familyId, legalCorpusFamilies.id))
    .innerJoin(legalSourceVersions, eq(legalSourceVersions.sourceId, legalSources.id))
    .innerJoin(legalSourceRenditions, eq(legalSourceRenditions.sourceVersionId, legalSourceVersions.id))
    .innerJoin(legalSourceProcessingGenerations, eq(legalSourceProcessingGenerations.renditionId, legalSourceRenditions.id))
    .leftJoin(backgroundJobs, eq(backgroundJobs.id, legalSourceProcessingGenerations.jobId))
    .orderBy(legalCorpusFamilies.code);

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
