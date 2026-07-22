import * as z from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  backgroundJobs,
  legalSourceChunkEmbeddings,
  legalSourceChunks,
  legalSourceProcessingGenerations,
} from "@/src/db/schema";
import { createContentEmbedder } from "@/src/server/content-processing/defaults";
import type { ContentEmbedder } from "@/src/server/content-processing/types";
import { validateEmbeddings } from "@/src/server/documents/embeddings";

const payloadSchema = z.object({ generationId: z.uuid() });

export async function handleLegalSourceEmbed(
  job: typeof backgroundJobs.$inferSelect,
  dependencies: { embedder?: ContentEmbedder } = {},
) {
  const { generationId } = payloadSchema.parse(job.payload);
  const generation = await db.query.legalSourceProcessingGenerations.findFirst({
    where: eq(legalSourceProcessingGenerations.id, generationId),
  });
  if (!generation) throw new Error("Legal processing generation not found");
  const chunks = await db.query.legalSourceChunks.findMany({
    where: eq(legalSourceChunks.generationId, generation.id),
    orderBy: [asc(legalSourceChunks.position)],
  });
  const embedder = dependencies.embedder ?? createContentEmbedder();
  const embeddings = await embedder.embed(chunks.map((chunk) => chunk.text));
  validateEmbeddings(embeddings, chunks.length, embedder.dimensions);
  await db.transaction(async (tx) => {
    await tx.insert(legalSourceChunkEmbeddings).values(chunks.map((chunk, index) => ({
      generationId: generation.id,
      chunkId: chunk.id,
      provider: embedder.provider,
      model: embedder.model,
      dimensions: embedder.dimensions,
      embedding: embeddings[index],
    }))).onConflictDoNothing();
    await tx.update(legalSourceProcessingGenerations).set({
      state: "review_required",
      updatedAt: new Date(),
    }).where(eq(legalSourceProcessingGenerations.id, generation.id));
  });
  return { type: "legal_processing_generation", id: generation.id };
}
