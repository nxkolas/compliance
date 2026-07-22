import { createHash, randomUUID } from "node:crypto";
import * as z from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  backgroundJobs,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
  platformAuditEvents,
} from "@/src/db/schema";
import { LEGAL_CORPUS_BUCKET, LEGAL_SOURCE_MIME_TYPES, MAX_LEGAL_SOURCE_BYTES } from "@/src/server/corpus/config";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { fetchControlledUrl } from "../security/controlled-url";

const payloadSchema = z.object({
  sourceId: z.uuid(),
  existingVersionId: z.uuid().optional(),
  exactUrl: z.url(),
  versionLabel: z.string().trim().min(1),
  officialIdentifier: z.string().optional(),
  effectiveFrom: z.iso.date().optional(),
  effectiveTo: z.iso.date().optional(),
  language: z.string().trim().min(2).max(16),
});

export async function handleLegalSourceImport(job: typeof backgroundJobs.$inferSelect) {
  const existing = await db.query.legalSourceRenditions.findFirst({
    where: eq(legalSourceRenditions.importJobId, job.id),
  });
  if (existing) return { type: "legal_source_rendition", id: existing.id };
  const payload = payloadSchema.parse(job.payload);
  const source = await db.query.legalSources.findFirst({
    where: eq(legalSources.id, payload.sourceId),
  });
  if (!source || source.withdrawnAt) throw new Error("Legal source is unavailable");
  const fetched = await fetchControlledUrl({
    url: payload.exactUrl,
    maxBytes: MAX_LEGAL_SOURCE_BYTES,
    timeoutMs: 30_000,
    allowedMimeTypes: LEGAL_SOURCE_MIME_TYPES,
  });
  const contentHash = createHash("sha256").update(fetched.bytes).digest("hex");
  const objectPath = `url-import/${source.id}/${randomUUID()}`;
  const { error } = await getSupabaseAdminClient().storage
    .from(LEGAL_CORPUS_BUCKET)
    .upload(objectPath, fetched.bytes, { contentType: fetched.mimeType, upsert: false });
  if (error) throw error;

  return db.transaction(async (tx) => {
    const duplicate = await tx.query.legalSourceRenditions.findFirst({
      where: eq(legalSourceRenditions.importJobId, job.id),
    });
    if (duplicate) return { type: "legal_source_rendition", id: duplicate.id };
    const existingVersion = payload.existingVersionId
      ? await tx.query.legalSourceVersions.findFirst({
          where: eq(legalSourceVersions.id, payload.existingVersionId),
        })
      : undefined;
    if (existingVersion && (existingVersion.sourceId !== source.id || existingVersion.status !== "draft" || existingVersion.contentHash !== contentHash)) {
      throw new Error("Candidate source version does not match the imported content");
    }
    const version = existingVersion ?? (await tx.insert(legalSourceVersions).values({
        sourceId: source.id,
        versionLabel: payload.versionLabel,
        officialIdentifier: payload.officialIdentifier,
        upstreamUrl: fetched.finalUrl,
        retrievedAt: new Date(),
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo,
        contentHash,
        createdBy: job.requestedByUserId ?? source.createdBy,
      }).returning())[0];
    if (!version) throw new Error("Could not create legal source version");
    const [rendition] = await tx.insert(legalSourceRenditions).values({
      sourceVersionId: version.id,
      language: payload.language,
      translationStatus: "official",
      storageBucket: LEGAL_CORPUS_BUCKET,
      storagePath: objectPath,
      mimeType: fetched.mimeType,
      byteSize: fetched.bytes.byteLength,
      contentHash,
      importJobId: job.id,
      importedFromUrl: fetched.finalUrl,
      createdBy: job.requestedByUserId ?? source.createdBy,
    }).returning();
    const [processJob] = await tx.insert(backgroundJobs).values({
      kind: "legal-source-process",
      payload: { renditionId: rendition.id },
      requestedByUserId: job.requestedByUserId,
      cancellable: true,
    }).returning();
    const [generation] = await tx.insert(legalSourceProcessingGenerations).values({
      renditionId: rendition.id,
      jobId: processJob.id,
      generationNumber: 1,
      parserConfig: { version: "legal-v1" },
      chunkerConfig: { version: "paragraph-v1" },
      embeddingConfig: { provider: "openai", model: "text-embedding-3-small", dimensions: 1536 },
    }).returning();
    await tx.update(backgroundJobs).set({ payload: { renditionId: rendition.id, generationId: generation.id } }).where(eq(backgroundJobs.id, processJob.id));
    await tx.insert(platformAuditEvents).values({
      actorUserId: job.requestedByUserId,
      eventType: "legal_source_url_import.completed",
      entityType: "legal_source_rendition",
      entityId: rendition.id,
      metadata: { sourceId: source.id, versionId: version.id, processJobId: processJob.id },
    });
    return { type: "legal_source_rendition", id: rendition.id };
  });
}
