import { db } from "@/src/db";
import {
  backgroundJobs,
  legalCorpusFamilies,
  legalCorpusReleaseMembers,
  legalCorpusReleases,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
  platformAuditEvents,
} from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { requestJobCancellation } from "@/src/server/jobs";
import { getSupabaseAdminClient } from "../supabase-admin";
import { and, asc, desc, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";

export async function getProcessingGeneration(input: {
  actorUserId: string;
  generationId: string;
  previewLimit?: number;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:read");
  const generation = await db.query.legalSourceProcessingGenerations.findFirst({ columns: { id: true, renditionId: true, jobId: true, embeddingJobId: true, generationNumber: true, state: true, parserConfig: true, ocrConfig: true, chunkerConfig: true, embeddingConfig: true, extractionHash: true, normalizedTextHash: true, qualityMetrics: true, reliableAnchors: true, reviewerId: true, reviewedAt: true, safeErrorCode: true, createdAt: true, updatedAt: true },
    where: eq(legalSourceProcessingGenerations.id, input.generationId),
  });
  if (!generation) throw new ApiError(404, "Processing generation not found", undefined, "PROCESSING_GENERATION_NOT_FOUND");
  const chunks = await db.query.legalSourceChunks.findMany({ columns: { id: true, generationId: true, position: true, text: true, textHash: true, pageNumber: true, sectionPath: true, provisionCode: true, anchorMetadata: true, tokenCount: true, searchVector: true, createdAt: true },
    where: eq(legalSourceChunks.generationId, generation.id),
    orderBy: [asc(legalSourceChunks.position)],
    limit: Math.max(1, Math.min(100, input.previewLimit ?? 20)),
  });
  return { generation, chunks };
}

export async function retryProcessingGeneration(input: {
  actorUserId: string;
  generationId: string;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:operate");
  return db.transaction(async (tx) => {
    const current = await tx.query.legalSourceProcessingGenerations.findFirst({ columns: { id: true, renditionId: true, jobId: true, embeddingJobId: true, generationNumber: true, state: true, parserConfig: true, ocrConfig: true, chunkerConfig: true, embeddingConfig: true, extractionHash: true, normalizedTextHash: true, qualityMetrics: true, reliableAnchors: true, reviewerId: true, reviewedAt: true, safeErrorCode: true, createdAt: true, updatedAt: true },
      where: eq(legalSourceProcessingGenerations.id, input.generationId),
    });
    if (!current || (current.state !== "failed" && current.state !== "cancelled")) {
      throw new ApiError(409, "Only failed or cancelled processing can be retried", undefined, "PROCESSING_NOT_RETRYABLE");
    }
    const latest = await tx.query.legalSourceProcessingGenerations.findFirst({ columns: { id: true, renditionId: true, jobId: true, embeddingJobId: true, generationNumber: true, state: true, parserConfig: true, ocrConfig: true, chunkerConfig: true, embeddingConfig: true, extractionHash: true, normalizedTextHash: true, qualityMetrics: true, reliableAnchors: true, reviewerId: true, reviewedAt: true, safeErrorCode: true, createdAt: true, updatedAt: true },
      where: eq(legalSourceProcessingGenerations.renditionId, current.renditionId),
      orderBy: [desc(legalSourceProcessingGenerations.generationNumber)],
    });
    if (latest?.id !== current.id) throw new ApiError(409, "A newer processing generation exists", undefined, "PROCESSING_SUPERSEDED");
    const [job] = await tx.insert(backgroundJobs).values({
      kind: "legal-source-process",
      payload: { renditionId: current.renditionId },
      requestedByUserId: input.actorUserId,
      cancellable: true,
    }).returning();
    const [generation] = await tx.insert(legalSourceProcessingGenerations).values({
      renditionId: current.renditionId,
      jobId: job.id,
      generationNumber: current.generationNumber + 1,
      parserConfig: current.parserConfig,
      ocrConfig: current.ocrConfig,
      chunkerConfig: current.chunkerConfig,
      embeddingConfig: current.embeddingConfig,
    }).returning();
    await tx.update(backgroundJobs).set({ payload: { renditionId: current.renditionId, generationId: generation.id } }).where(eq(backgroundJobs.id, job.id));
    await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_processing_generation.retried", entityType: "legal_processing_generation", entityId: generation.id, requestId: input.requestId, metadata: { previousGenerationId: current.id, jobId: job.id } });
    return { generation, job };
  });
}

export async function cancelProcessingGeneration(input: {
  actorUserId: string;
  generationId: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:operate");
  const generation = await db.query.legalSourceProcessingGenerations.findFirst({ columns: { id: true, renditionId: true, jobId: true, embeddingJobId: true, generationNumber: true, state: true, parserConfig: true, ocrConfig: true, chunkerConfig: true, embeddingConfig: true, extractionHash: true, normalizedTextHash: true, qualityMetrics: true, reliableAnchors: true, reviewerId: true, reviewedAt: true, safeErrorCode: true, createdAt: true, updatedAt: true },
    where: eq(legalSourceProcessingGenerations.id, input.generationId),
  });
  if (!generation) throw new ApiError(404, "Processing generation not found", undefined, "PROCESSING_GENERATION_NOT_FOUND");
  const activeJobId = generation.embeddingJobId ?? generation.jobId;
  if (!activeJobId) throw new ApiError(404, "Processing job not found", undefined, "PROCESSING_JOB_NOT_FOUND");
  const job = await requestJobCancellation(input.actorUserId, activeJobId);
  if (job.state === "cancelled") {
    await db.update(legalSourceProcessingGenerations).set({ state: "cancelled", updatedAt: new Date() })
      .where(eq(legalSourceProcessingGenerations.id, generation.id));
  }
  return job;
}

export async function getLegalCitationSource(input: {
  actorUserId: string;
  corpusReleaseId: string;
  chunkId: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:read");
  const [row] = await db.select({
    chunk: legalSourceChunks,
    generation: legalSourceProcessingGenerations,
    rendition: legalSourceRenditions,
    version: legalSourceVersions,
    source: legalSources,
    family: legalCorpusFamilies,
    release: legalCorpusReleases,
  }).from(legalCorpusReleaseMembers)
    .innerJoin(legalCorpusReleases, eq(legalCorpusReleaseMembers.releaseId, legalCorpusReleases.id))
    .innerJoin(legalCorpusFamilies, eq(legalCorpusReleases.familyId, legalCorpusFamilies.id))
    .innerJoin(legalSourceVersions, eq(legalCorpusReleaseMembers.sourceVersionId, legalSourceVersions.id))
    .innerJoin(legalSources, eq(legalSourceVersions.sourceId, legalSources.id))
    .innerJoin(legalSourceRenditions, eq(legalCorpusReleaseMembers.renditionId, legalSourceRenditions.id))
    .innerJoin(legalSourceProcessingGenerations, eq(legalCorpusReleaseMembers.processingGenerationId, legalSourceProcessingGenerations.id))
    .innerJoin(legalSourceChunks, and(eq(legalSourceChunks.generationId, legalSourceProcessingGenerations.id), eq(legalSourceChunks.id, input.chunkId)))
    .where(and(eq(legalCorpusReleases.id, input.corpusReleaseId), eq(legalCorpusReleases.status, "published")))
    .limit(1);
  if (!row) throw new ApiError(404, "Citation source not found", undefined, "CITATION_SOURCE_NOT_FOUND");
  return row;
}

export async function createLegalSourceAccess(input: {
  actorUserId: string;
  renditionId: string;
  expiresInSeconds?: number;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:read");
  const rendition = await db.query.legalSourceRenditions.findFirst({ columns: { id: true, sourceVersionId: true, language: true, translationStatus: true, authoritativeRenditionId: true, storageBucket: true, storagePath: true, mimeType: true, byteSize: true, contentHash: true, duplicateAcknowledged: true, uploadSessionId: true, importJobId: true, importedFromUrl: true, createdBy: true, createdAt: true },
    where: eq(legalSourceRenditions.id, input.renditionId),
  });
  if (!rendition) throw new ApiError(404, "Rendition not found", undefined, "RENDITION_NOT_FOUND");
  const { data, error } = await getSupabaseAdminClient().storage
    .from(rendition.storageBucket)
    .createSignedUrl(rendition.storagePath, Math.max(30, Math.min(600, input.expiresInSeconds ?? 120)));
  if (error) throw new ApiError(502, "Source access could not be created", undefined, "SOURCE_ACCESS_FAILED");
  return { url: data.signedUrl, expiresInSeconds: input.expiresInSeconds ?? 120 };
}
