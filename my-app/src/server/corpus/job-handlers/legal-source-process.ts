import { createHash } from "node:crypto";
import * as z from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  backgroundJobs,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
} from "@/src/db/schema";
import { legalContentParser, paragraphContentChunker } from "@/src/server/content-processing/defaults";
import type { ContentChunker, ContentParser } from "@/src/server/content-processing/types";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import type { MalwareScanner } from "../adapters/malware";
import { noOpDevelopmentMalwareScanner } from "../adapters/malware";
import { parseWithDocling } from "../adapters/docling";
import { ApiError } from "@/src/server/api/errors";

const payloadSchema = z.object({ renditionId: z.uuid(), generationId: z.uuid().optional() });
const MAX_PAGES = 2_000;
const MAX_TEXT_CHARACTERS = 10_000_000;

export async function handleLegalSourceProcess(
  job: typeof backgroundJobs.$inferSelect,
  dependencies: {
    parser?: ContentParser;
    chunker?: ContentChunker;
    malwareScanner?: MalwareScanner;
  } = {},
) {
  const { renditionId, generationId } = payloadSchema.parse(job.payload);
  const rendition = await db.query.legalSourceRenditions.findFirst({ columns: { id: true, sourceVersionId: true, language: true, translationStatus: true, authoritativeRenditionId: true, storageBucket: true, storagePath: true, mimeType: true, byteSize: true, contentHash: true, duplicateAcknowledged: true, uploadSessionId: true, importJobId: true, importedFromUrl: true, createdBy: true, createdAt: true },
    where: eq(legalSourceRenditions.id, renditionId),
  });
  if (!rendition) throw new Error("Legal source rendition not found");
  const generation = await db.query.legalSourceProcessingGenerations.findFirst({ columns: { id: true, renditionId: true, jobId: true, embeddingJobId: true, generationNumber: true, state: true, parserConfig: true, ocrConfig: true, chunkerConfig: true, embeddingConfig: true, extractionHash: true, normalizedTextHash: true, qualityMetrics: true, reliableAnchors: true, reviewerId: true, reviewedAt: true, safeErrorCode: true, createdAt: true, updatedAt: true },
    where: generationId
      ? and(eq(legalSourceProcessingGenerations.id, generationId), eq(legalSourceProcessingGenerations.renditionId, rendition.id))
      : and(eq(legalSourceProcessingGenerations.renditionId, rendition.id), eq(legalSourceProcessingGenerations.jobId, job.id)),
  });
  if (!generation) throw new Error("Legal processing generation not found");
  if (generation.embeddingJobId) return { type: "legal_processing_generation", id: generation.id };

  const { data, error } = await getSupabaseAdminClient().storage
    .from(rendition.storageBucket)
    .download(rendition.storagePath);
  if (error) throw error;
  const bytes = new Uint8Array(await data.arrayBuffer());
  await (dependencies.malwareScanner ?? noOpDevelopmentMalwareScanner).scan({
    bytes,
    fileName: rendition.storagePath,
    mimeType: rendition.mimeType,
  });
  let parsed;
  try {
    parsed = await (dependencies.parser ?? legalContentParser).parse(bytes, rendition.mimeType);
  } catch (error) {
    const endpoint = process.env.DOCLING_SERVICE_URL?.trim();
    if (!(error instanceof ApiError) || error.status !== 422 || !endpoint) throw error;
    const docling = await parseWithDocling(bytes, rendition.mimeType, {
      endpoint,
      timeoutMs: 120_000,
      maxOutputCharacters: MAX_TEXT_CHARACTERS,
    });
    parsed = {
      parserKind: "plain-text" as const,
      parserVersion: "v1" as const,
      pages: docling.pages,
      text: docling.text,
      metadata: { ...docling.metadata, docling: true, anchorsReliable: docling.anchorsReliable },
    };
  }
  if (parsed.pages.length > MAX_PAGES || parsed.text.length > MAX_TEXT_CHARACTERS) {
    throw new Error("Legal source extraction exceeded configured limits");
  }
  const chunks = (dependencies.chunker ?? paragraphContentChunker).chunk(parsed.pages);
  if (chunks.length === 0) throw new Error("Legal source produced no chunks");
  const reliableAnchors = parsed.metadata.anchorsReliable === false
    ? false
    : chunks.every((chunk) => chunk.pageNumber !== null || chunk.sectionLabel !== null);

  await db.transaction(async (tx) => {
    await tx.update(legalSourceProcessingGenerations).set({
      state: "running",
      extractionHash: createHash("sha256").update(JSON.stringify(parsed.metadata)).digest("hex"),
      normalizedTextHash: createHash("sha256").update(parsed.text).digest("hex"),
      qualityMetrics: { pageCount: parsed.pages.length, characterCount: parsed.text.length, chunkCount: chunks.length },
      reliableAnchors,
      updatedAt: new Date(),
    }).where(eq(legalSourceProcessingGenerations.id, generation.id));
    await tx.insert(legalSourceChunks).values(chunks.map((chunk) => ({
      generationId: generation.id,
      position: chunk.chunkIndex,
      text: chunk.content,
      textHash: createHash("sha256").update(chunk.content).digest("hex"),
      pageNumber: chunk.pageNumber,
      sectionPath: chunk.sectionLabel,
      tokenCount: chunk.tokenCount,
      searchVector: sql`to_tsvector('simple', ${chunk.content})`,
    }))).onConflictDoNothing();
    const [embeddingJob] = await tx.insert(backgroundJobs).values({
      kind: "legal-source-embed",
      payload: { generationId: generation.id },
      requestedByUserId: job.requestedByUserId,
      cancellable: true,
    }).returning();
    await tx.update(legalSourceProcessingGenerations).set({
      embeddingJobId: embeddingJob.id,
      updatedAt: new Date(),
    }).where(eq(legalSourceProcessingGenerations.id, generation.id));
  });
  return { type: "legal_processing_generation", id: generation.id };
}
