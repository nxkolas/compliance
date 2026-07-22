import * as z from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  backgroundJobs,
  legalCorpusEvaluations,
  legalCorpusReleaseMembers,
  legalCorpusReleases,
  legalSourceChunks,
  legalSourceProcessingGenerations,
} from "@/src/db/schema";
import { runGroundingSafetyFixtures } from "@/src/server/corpus/evaluation-fixtures";

const payloadSchema = z.object({ releaseId: z.uuid() });

export async function handleGroundingEvaluation(job: typeof backgroundJobs.$inferSelect) {
  const existing = await db.query.legalCorpusEvaluations.findFirst({
    where: eq(legalCorpusEvaluations.jobId, job.id),
  });
  if (existing) return { type: "legal_corpus_evaluation", id: existing.id };
  const { releaseId } = payloadSchema.parse(job.payload);
  const release = await db.query.legalCorpusReleases.findFirst({
    where: eq(legalCorpusReleases.id, releaseId),
  });
  if (!release || release.status !== "published") throw new Error("Published corpus release not found");
  const [integrity] = await db.select({
    memberCount: sql<number>`count(distinct ${legalCorpusReleaseMembers.sourceVersionId})::int`,
    reviewedGenerationCount: sql<number>`count(distinct case when ${legalSourceProcessingGenerations.state} = 'reviewed' and ${legalSourceProcessingGenerations.reliableAnchors} then ${legalSourceProcessingGenerations.id} end)::int`,
    chunkCount: sql<number>`count(distinct ${legalSourceChunks.id})::int`,
    anchoredChunkCount: sql<number>`count(distinct case when ${legalSourceChunks.pageNumber} is not null or ${legalSourceChunks.sectionPath} is not null then ${legalSourceChunks.id} end)::int`,
    provisionChunkCount: sql<number>`count(distinct case when ${legalSourceChunks.provisionCode} is not null then ${legalSourceChunks.id} end)::int`,
  }).from(legalCorpusReleaseMembers)
    .innerJoin(legalSourceProcessingGenerations, eq(legalCorpusReleaseMembers.processingGenerationId, legalSourceProcessingGenerations.id))
    .innerJoin(legalSourceChunks, eq(legalSourceChunks.generationId, legalSourceProcessingGenerations.id))
    .where(eq(legalCorpusReleaseMembers.releaseId, release.id));
  const fixtures = runGroundingSafetyFixtures();
  const integrityFailures = [
    ...(integrity.memberCount < 1 ? ["release_has_no_members"] : []),
    ...(integrity.reviewedGenerationCount !== integrity.memberCount ? ["member_generation_not_reviewed"] : []),
    ...(integrity.chunkCount < 1 ? ["release_has_no_chunks"] : []),
    ...(integrity.anchoredChunkCount !== integrity.chunkCount ? ["unanchored_chunks"] : []),
  ];
  const failures = [...integrityFailures, ...fixtures.failures];
  const passed = failures.length === 0;
  const [evaluation] = await db.transaction(async (tx) => {
    const rows = await tx.insert(legalCorpusEvaluations).values({
      releaseId: release.id,
      jobId: job.id,
      fixtureSetVersion: fixtures.version,
      passed,
      metrics: {
        ...fixtures.metrics,
        memberCount: integrity.memberCount,
        chunkCount: integrity.chunkCount,
        anchorCoverage: integrity.chunkCount ? integrity.anchoredChunkCount / integrity.chunkCount : 0,
        provisionAnchorCoverage: integrity.chunkCount ? integrity.provisionChunkCount / integrity.chunkCount : 0,
      },
      failures,
    }).returning();
    await tx.update(legalCorpusReleases).set({
      evaluationState: passed ? "passed" : "failed",
      updatedAt: new Date(),
    }).where(and(eq(legalCorpusReleases.id, release.id), eq(legalCorpusReleases.evaluationJobId, job.id)));
    return rows;
  });
  return { type: "legal_corpus_evaluation", id: evaluation.id };
}
