import { db } from "@/src/db";
import { legalSourceChunkEmbeddings, legalSourceChunks, legalSourceProcessingGenerations, legalSourceVersions, platformAuditEvents } from "@/src/db/schema";
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
    const generation = await tx.query.legalSourceProcessingGenerations.findFirst({ columns: { id: true, renditionId: true, jobId: true, embeddingJobId: true, generationNumber: true, state: true, parserConfig: true, ocrConfig: true, chunkerConfig: true, embeddingConfig: true, extractionHash: true, normalizedTextHash: true, qualityMetrics: true, reliableAnchors: true, reviewerId: true, reviewedAt: true, safeErrorCode: true, createdAt: true, updatedAt: true },
      where: { RAW: (table, operators) => (eq(table.id, input.generationId)) ?? operators.sql`true` },
    });
    if (!generation) throw new ApiError(404, "Processing generation not found", undefined, "PROCESSING_GENERATION_NOT_FOUND");
    if (generation.state !== "review_required" || !generation.reliableAnchors) {
      throw new ApiError(409, "Processing generation is not reviewable", undefined, "PROCESSING_NOT_REVIEWABLE");
    }
    if (!generation.extractionHash || !generation.normalizedTextHash || !generation.embeddingJobId) {
      throw new ApiError(409, "Processing generation is incomplete", undefined, "PROCESSING_INCOMPLETE");
    }
    const embeddingJob = await tx.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.id, generation.embeddingJobId!),
        eq(table.state, "succeeded"),
      )) ?? operators.sql`true` },
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
    const rendition = await tx.query.legalSourceRenditions.findFirst({ columns: { id: true, sourceVersionId: true, language: true, translationStatus: true, authoritativeRenditionId: true, storageBucket: true, storagePath: true, mimeType: true, byteSize: true, contentHash: true, duplicateAcknowledged: true, uploadSessionId: true, importJobId: true, importedFromUrl: true, createdBy: true, createdAt: true },
      where: { RAW: (table, operators) => (eq(table.id, generation.renditionId)) ?? operators.sql`true` },
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
