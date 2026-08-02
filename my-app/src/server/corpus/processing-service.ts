import { createHash } from "node:crypto";
import { db } from "@/src/db";
import {
  legalSourceChunkEmbeddings,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
} from "@/src/db/schema";
import {
  createContentEmbedder,
  legalContentParser,
  paragraphContentChunker,
} from "@/src/server/content-processing/defaults";
import type { ContentChunker, ContentEmbedder, ContentParser } from "@/src/server/content-processing/types";
import { validateEmbeddings } from "@/src/server/documents/domain";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { and, eq } from "drizzle-orm";

type Dependencies = {
  parser?: ContentParser;
  chunker?: ContentChunker;
  embedder?: ContentEmbedder;
  download?: (bucket: string, key: string) => Promise<Uint8Array>;
};

export async function executeLegalSourceProcessingJob(
  input: { jobId: string; processingGenerationId: string; abortSignal?: AbortSignal },
  dependencies: Dependencies = {},
) {
  if (input.abortSignal?.aborted) throw input.abortSignal.reason;
  const row = await db.select({
    generation: legalSourceProcessingGenerations,
    rendition: legalSourceRenditions,
  }).from(legalSourceProcessingGenerations)
    .innerJoin(legalSourceRenditions, and(
      eq(legalSourceRenditions.id, legalSourceProcessingGenerations.renditionId),
      eq(legalSourceRenditions.sourceVersionId, legalSourceProcessingGenerations.sourceVersionId),
    ))
    .where(eq(legalSourceProcessingGenerations.id, input.processingGenerationId))
    .limit(1);
  const target = row[0];
  if (!target) throw new Error("Legal-source processing generation not found");
  if (target.generation.jobId && target.generation.jobId !== input.jobId) {
    throw new Error("Legal-source processing generation belongs to another job");
  }
  if (target.generation.status === "succeeded") {
    return { type: "legal_source_processing_generation", id: target.generation.id };
  }

  const parser = dependencies.parser ?? legalContentParser;
  const chunker = dependencies.chunker ?? paragraphContentChunker;
  const embedder = dependencies.embedder ?? createContentEmbedder();
  if (embedder.model !== target.generation.embeddingModel) {
    throw new Error("The processing generation embedding model does not match the deployed embedder");
  }
  const download = dependencies.download ?? downloadRendition;
  await db.update(legalSourceProcessingGenerations).set({
    jobId: input.jobId,
    status: "processing",
    startedAt: new Date(),
    completedAt: null,
    failureCode: null,
    failureMessage: null,
  }).where(eq(legalSourceProcessingGenerations.id, target.generation.id));

  try {
    const bytes = await download(target.rendition.storageBucket, target.rendition.storageKey);
    if (input.abortSignal?.aborted) throw input.abortSignal.reason;
    const parsed = await parser.parse(bytes, inferMimeType(target.rendition.storageKey));
    const chunks = chunker.chunk(parsed.pages);
    const embeddings = await embedder.embed(chunks.map((chunk) => chunk.content));
    validateEmbeddings(embeddings, chunks.length, embedder.dimensions);
    await db.transaction(async (tx) => {
      await tx.delete(legalSourceChunks).where(eq(legalSourceChunks.processingGenerationId, target.generation.id));
      if (chunks.length) {
        const inserted = await tx.insert(legalSourceChunks).values(chunks.map((chunk, position) => ({
          processingGenerationId: target.generation.id,
          sourceVersionId: target.generation.sourceVersionId,
          renditionId: target.generation.renditionId,
          position,
          pageNumber: chunk.pageNumber,
          sectionPath: chunk.sectionLabel,
          text: chunk.content,
          contentHash: createHash("sha256").update(chunk.content).digest("hex"),
        }))).returning({ id: legalSourceChunks.id, position: legalSourceChunks.position });
        await tx.insert(legalSourceChunkEmbeddings).values(inserted.map((chunk) => ({
          chunkId: chunk.id,
          model: embedder.model,
          embedding: embeddings[chunk.position]!,
        })));
      }
      await tx.update(legalSourceProcessingGenerations).set({
        status: "succeeded",
        parser: parsed.parserKind,
        completedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      }).where(eq(legalSourceProcessingGenerations.id, target.generation.id));
    });
    return { type: "legal_source_processing_generation", id: target.generation.id };
  } catch (error) {
    await db.update(legalSourceProcessingGenerations).set({
      status: "failed",
      completedAt: new Date(),
      failureCode: "LEGAL_SOURCE_PROCESSING_FAILED",
      failureMessage: error instanceof Error ? error.message : "Legal-source processing failed",
    }).where(eq(legalSourceProcessingGenerations.id, target.generation.id));
    throw error;
  }
}

async function downloadRendition(bucket: string, key: string) {
  const { data, error } = await getSupabaseAdminClient().storage.from(bucket).download(key);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

function inferMimeType(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".md")) return "text/markdown";
  return "text/plain";
}
