import { createHash } from "node:crypto";
import { db } from "@/src/db";
import {
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
} from "@/src/db/schema";
import {
  legalContentParser,
  paragraphContentChunker,
} from "@/src/server/content-processing/defaults";
import type { ContentChunker, ContentParser } from "@/src/server/content-processing/types";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { eq } from "drizzle-orm";

type Dependencies = {
  parser?: ContentParser;
  chunker?: ContentChunker;
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
    .innerJoin(
      legalSourceRenditions,
      eq(legalSourceRenditions.id, legalSourceProcessingGenerations.renditionId),
    )
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
    await db.transaction(async (tx) => {
      await tx.delete(legalSourceChunks).where(eq(legalSourceChunks.processingGenerationId, target.generation.id));
      if (chunks.length) {
        await tx.insert(legalSourceChunks).values(chunks.map((chunk, position) => ({
          processingGenerationId: target.generation.id,
          position,
          pageNumber: chunk.pageNumber,
          sectionPath: chunk.sectionLabel,
          text: chunk.content,
          contentHash: createHash("sha256").update(chunk.content).digest("hex"),
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
