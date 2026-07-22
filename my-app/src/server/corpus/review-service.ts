import { db } from "@/src/db";
import {
  backgroundJobs,
  legalSourceChunkEmbeddings,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSourceVersions,
  platformAuditEvents,
} from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { and, eq, sql } from "drizzle-orm";
import { ApiError } from "../api/errors";

export async function reviewLegalProcessingGeneration(input: {
  actorUserId: string;
  generationId: string;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:review");
  return db.transaction(async (tx) => {
    const generation = await tx.query.legalSourceProcessingGenerations.findFirst({
      where: eq(legalSourceProcessingGenerations.id, input.generationId),
    });
    if (!generation) throw new ApiError(404, "Processing generation not found", undefined, "PROCESSING_GENERATION_NOT_FOUND");
    if (generation.state !== "review_required" || !generation.reliableAnchors) {
      throw new ApiError(409, "Processing generation is not reviewable", undefined, "PROCESSING_NOT_REVIEWABLE");
    }
    if (!generation.extractionHash || !generation.normalizedTextHash || !generation.embeddingJobId) {
      throw new ApiError(409, "Processing generation is incomplete", undefined, "PROCESSING_INCOMPLETE");
    }
    const embeddingJob = await tx.query.backgroundJobs.findFirst({
      where: and(
        eq(backgroundJobs.id, generation.embeddingJobId),
        eq(backgroundJobs.state, "succeeded"),
      ),
    });
    const [coverage] = await tx
      .select({
        chunks: sql<number>`count(${legalSourceChunks.id})::int`,
        embeddings: sql<number>`count(${legalSourceChunkEmbeddings.chunkId})::int`,
      })
      .from(legalSourceChunks)
      .leftJoin(
        legalSourceChunkEmbeddings,
        and(
          eq(legalSourceChunkEmbeddings.generationId, generation.id),
          eq(legalSourceChunkEmbeddings.chunkId, legalSourceChunks.id),
        ),
      )
      .where(eq(legalSourceChunks.generationId, generation.id));
    if (!embeddingJob || !coverage || coverage.chunks === 0 || coverage.embeddings !== coverage.chunks) {
      throw new ApiError(409, "Processing generation is incomplete", undefined, "PROCESSING_INCOMPLETE");
    }
    const rendition = await tx.query.legalSourceRenditions.findFirst({
      where: eq(legalSourceRenditions.id, generation.renditionId),
    });
    if (!rendition) throw new ApiError(409, "Rendition is missing", undefined, "RENDITION_MISSING");
    const now = new Date();
    const [reviewed] = await tx.update(legalSourceProcessingGenerations).set({
      state: "reviewed",
      reviewerId: input.actorUserId,
      reviewedAt: now,
      updatedAt: now,
    }).where(and(
      eq(legalSourceProcessingGenerations.id, generation.id),
      eq(legalSourceProcessingGenerations.state, "review_required"),
    )).returning();
    if (!reviewed) throw new ApiError(409, "Processing generation changed", undefined, "PROCESSING_CHANGED");
    await tx.update(legalSourceVersions).set({
      status: "reviewed",
      reviewedBy: input.actorUserId,
      reviewedAt: now,
    }).where(and(
      eq(legalSourceVersions.id, rendition.sourceVersionId),
      eq(legalSourceVersions.status, "draft"),
    ));
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_processing_generation.reviewed",
      entityType: "legal_processing_generation",
      entityId: reviewed.id,
      requestId: input.requestId,
      metadata: { renditionId: rendition.id, sourceVersionId: rendition.sourceVersionId },
    });
    return reviewed;
  });
}
