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
import { runGroundingSafetyFixtures } from "../evaluation-fixtures";
import { throwIfJobExecutionAborted } from "@/src/server/job-execution/abort";

const payloadSchema = z.object({ releaseId: z.uuid() });

export async function handleGroundingEvaluation(
  job: typeof backgroundJobs.$inferSelect,
  abortSignal?: AbortSignal,
) {
  throwIfJobExecutionAborted(abortSignal);
  const existing = await db.query.legalCorpusEvaluations.findFirst({ columns: { id: true, releaseId: true, jobId: true, fixtureSetVersion: true, passed: true, metrics: true, failures: true, evaluatedAt: true },
    where: { RAW: (table, operators) => (eq(table.jobId, job.id)) ?? operators.sql`true` },
  });
  if (existing) return { type: "legal_corpus_evaluation", id: existing.id };
  const { releaseId } = payloadSchema.parse(job.payload);
  const release = await db.query.legalCorpusReleases.findFirst({ columns: { id: true, familyId: true, versionLabel: true, contentHash: true, status: true, evaluationState: true, evaluationJobId: true, publishedBy: true, publishedAt: true, withdrawnBy: true, withdrawnAt: true, withdrawalReason: true, version: true, createdBy: true, createdAt: true, updatedAt: true },
    where: { RAW: (table, operators) => (eq(table.id, releaseId)) ?? operators.sql`true` },
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
  throwIfJobExecutionAborted(abortSignal);
  const integrityFailures = [
    ...(integrity.memberCount < 1 ? ["release_has_no_members"] : []),
    ...(integrity.reviewedGenerationCount !== integrity.memberCount ? ["member_generation_not_reviewed"] : []),
    ...(integrity.chunkCount < 1 ? ["release_has_no_chunks"] : []),
    ...(integrity.anchoredChunkCount !== integrity.chunkCount ? ["unanchored_chunks"] : []),
  ];
  const failures = [...integrityFailures, ...fixtures.failures];
  const passed = failures.length === 0;
  const [evaluation] = await db.transaction(async (tx) => {
    throwIfJobExecutionAborted(abortSignal);
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
  throwIfJobExecutionAborted(abortSignal);
  return { type: "legal_corpus_evaluation", id: evaluation.id };
}
