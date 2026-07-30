import * as z from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { backgroundJobs, legalSourceChunkEmbeddings, legalSourceProcessingGenerations } from "@/src/db/schema";
import { createContentEmbedder } from "@/src/server/content-processing/defaults";
import type { ContentEmbedder } from "@/src/server/content-processing/types";
import { validateEmbeddings } from "@/src/server/documents";
import { throwIfJobExecutionAborted } from "@/src/server/job-execution/abort";

const payloadSchema = z.object({ generationId: z.uuid() });

export async function handleLegalSourceEmbed(
  job: typeof backgroundJobs.$inferSelect,
  dependencies: { embedder?: ContentEmbedder } = {},
  abortSignal?: AbortSignal,
) {
  throwIfJobExecutionAborted(abortSignal);
  const { generationId } = payloadSchema.parse(job.payload);
  const generation = await db.query.legalSourceProcessingGenerations.findFirst({ columns: { id: true, renditionId: true, jobId: true, embeddingJobId: true, generationNumber: true, state: true, parserConfig: true, ocrConfig: true, chunkerConfig: true, embeddingConfig: true, extractionHash: true, normalizedTextHash: true, qualityMetrics: true, reliableAnchors: true, reviewerId: true, reviewedAt: true, safeErrorCode: true, createdAt: true, updatedAt: true },
    where: { RAW: (table, operators) => (eq(table.id, generationId)) ?? operators.sql`true` },
  });
  if (!generation) throw new Error("Legal processing generation not found");
  const chunks = await db.query.legalSourceChunks.findMany({ columns: { id: true, generationId: true, position: true, text: true, textHash: true, pageNumber: true, sectionPath: true, provisionCode: true, anchorMetadata: true, tokenCount: true, searchVector: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.generationId, generation.id)) ?? operators.sql`true` },
    orderBy: { position: "asc" },
  });
  const embedder = dependencies.embedder ?? createContentEmbedder();
  const embeddings: number[][] = [];
  for (let offset = 0; offset < chunks.length; offset += 32) {
    throwIfJobExecutionAborted(abortSignal);
    const batch = chunks.slice(offset, offset + 32);
    embeddings.push(...(await embedder.embed(batch.map((chunk) => chunk.text))));
  }
  throwIfJobExecutionAborted(abortSignal);
  validateEmbeddings(embeddings, chunks.length, embedder.dimensions);
  await db.transaction(async (tx) => {
    throwIfJobExecutionAborted(abortSignal);
    await tx.insert(legalSourceChunkEmbeddings).values(chunks.map((chunk, index) => ({
      generationId: generation.id,
      chunkId: chunk.id,
      provider: embedder.provider,
      model: embedder.model,
      modelRevision: embedder.modelRevision,
      dimensions: embedder.dimensions,
      retrievalInstructionId: embedder.retrievalInstructionId,
      embedding: embeddings[index],
    }))).onConflictDoNothing();
    await tx.update(legalSourceProcessingGenerations).set({
      state: "review_required",
      updatedAt: new Date(),
    }).where(eq(legalSourceProcessingGenerations.id, generation.id));
  });
  throwIfJobExecutionAborted(abortSignal);
  return { type: "legal_processing_generation", id: generation.id };
}
