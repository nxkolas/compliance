import { createHash } from "node:crypto";
import { db } from "@/src/db";
import { backgroundJobs, legalSourceProcessingGenerations, legalSourceRenditions, legalSourceVersions, platformAuditEvents, uploadSessionResults, uploadSessions } from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { createUploadSession, verifyUploadedObject } from "@/src/server/uploads";
import { getSupabaseAdminClient } from "../supabase-admin";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  LEGAL_CORPUS_BUCKET,
  LEGAL_SOURCE_MIME_TYPES,
  LEGAL_SOURCE_UPLOAD_TTL_SECONDS,
  MAX_LEGAL_SOURCE_BYTES,
} from "./config";

export async function createLegalSourceUploadSession(input: {
  actorUserId: string;
  sourceId: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  const source = await db.query.legalSources.findFirst({ columns: { id: true, familyId: true, stableCode: true, title: true, sourceKind: true, authorityTier: true, canonicalPublisher: true, legalInstrumentId: true, legalProvisionId: true, withdrawnAt: true, withdrawalReason: true, version: true, createdBy: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, input.sourceId)) ?? operators.sql`true` } });
  if (!source || source.withdrawnAt) throw new ApiError(404, "Legal source not found", undefined, "LEGAL_SOURCE_NOT_FOUND");
  return createUploadSession({
    userId: input.actorUserId,
    scope: `legal-source:${source.id}`,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    sha256: input.sha256,
    policy: {
      bucket: LEGAL_CORPUS_BUCKET,
      maxBytes: MAX_LEGAL_SOURCE_BYTES,
      allowedMimeTypes: LEGAL_SOURCE_MIME_TYPES,
      expiresInSeconds: LEGAL_SOURCE_UPLOAD_TTL_SECONDS,
    },
    signUpload: async ({ bucket, objectPath }) => {
      const { data, error } = await getSupabaseAdminClient().storage.from(bucket).createSignedUploadUrl(objectPath);
      if (error) throw error;
      return data.token;
    },
  });
}

export async function completeLegalSourceUpload(input: {
  actorUserId: string;
  sourceId: string;
  sessionId: string;
  existingVersionId?: string;
  versionLabel: string;
  officialIdentifier?: string;
  upstreamUrl?: string;
  upstreamPublishedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  language: string;
  translationStatus: "official" | "reviewed_internal" | "machine_assisted";
  authoritativeRenditionId?: string;
  duplicateAcknowledged?: boolean;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  const verified = await verifyUploadedObject({
    sessionId: input.sessionId,
    userId: input.actorUserId,
    verifyObject: verifyStoredObject,
  });
  if (verified.scope !== `legal-source:${input.sourceId}`) {
    throw new ApiError(404, "Upload session not found", undefined, "UPLOAD_SESSION_NOT_FOUND");
  }
  if (verified.state === "completed") {
    const completedResult = await db.query.uploadSessionResults.findFirst({
      where: { RAW: (table, operators) => (eq(table.sessionId, verified.id)) ?? operators.sql`true` },
      columns: { legalSourceRenditionId: true },
    });
    const renditionId = completedResult?.legalSourceRenditionId;
    if (!renditionId) throw new ApiError(409, "Completed upload result is unavailable", undefined, "UPLOAD_RESULT_MISSING");
    const rendition = await db.query.legalSourceRenditions.findFirst({ columns: { id: true, sourceVersionId: true, language: true, translationStatus: true, authoritativeRenditionId: true, storageBucket: true, storagePath: true, mimeType: true, byteSize: true, contentHash: true, duplicateAcknowledged: true, uploadSessionId: true, importJobId: true, importedFromUrl: true, createdBy: true, createdAt: true },
      where: { RAW: (table, operators) => (eq(table.id, renditionId)) ?? operators.sql`true` },
    });
    if (!rendition) throw new ApiError(409, "Completed upload result is unavailable", undefined, "UPLOAD_RESULT_MISSING");
    const version = await db.query.legalSourceVersions.findFirst({ columns: { id: true, sourceId: true, versionLabel: true, officialIdentifier: true, upstreamPublishedAt: true, retrievedAt: true, upstreamUrl: true, effectiveFrom: true, effectiveTo: true, contentHash: true, status: true, reviewedBy: true, reviewedAt: true, publishedAt: true, withdrawnBy: true, withdrawnAt: true, withdrawalReason: true, createdBy: true, createdAt: true },
      where: { RAW: (table, operators) => (eq(table.id, rendition.sourceVersionId)) ?? operators.sql`true` },
    });
    const generation = await db.query.legalSourceProcessingGenerations.findFirst({ columns: { id: true, renditionId: true, jobId: true, embeddingJobId: true, generationNumber: true, state: true, parserConfig: true, ocrConfig: true, chunkerConfig: true, embeddingConfig: true, extractionHash: true, normalizedTextHash: true, qualityMetrics: true, reliableAnchors: true, reviewerId: true, reviewedAt: true, safeErrorCode: true, createdAt: true, updatedAt: true },
      where: { RAW: (table, operators) => (eq(table.renditionId, rendition.id)) ?? operators.sql`true` },
    });
    const job = generation?.jobId
      ? await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, generation.jobId!)) ?? operators.sql`true` } })
      : undefined;
    if (!version || !generation || !job) throw new ApiError(409, "Completed upload result is incomplete", undefined, "UPLOAD_RESULT_MISSING");
    return { version, rendition, generation, job };
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx.select({
      id: uploadSessions.id,
      bucket: uploadSessions.bucket,
      objectPath: uploadSessions.objectPath,
      actualMimeType: uploadSessions.actualMimeType,
      actualSize: uploadSessions.actualSize,
      actualSha256: uploadSessions.actualSha256,
    }).from(uploadSessions)
      .where(and(eq(uploadSessions.id, input.sessionId), eq(uploadSessions.state, "verified")))
      .limit(1).for("update");
    if (!locked?.actualSha256 || !locked.actualMimeType || !locked.actualSize) {
      throw new ApiError(409, "Upload session is not verified", undefined, "UPLOAD_SESSION_NOT_VERIFIED");
    }
    const existingVersion = input.existingVersionId
      ? await tx.query.legalSourceVersions.findFirst({ columns: { id: true, sourceId: true, versionLabel: true, officialIdentifier: true, upstreamPublishedAt: true, retrievedAt: true, upstreamUrl: true, effectiveFrom: true, effectiveTo: true, contentHash: true, status: true, reviewedBy: true, reviewedAt: true, publishedAt: true, withdrawnBy: true, withdrawnAt: true, withdrawalReason: true, createdBy: true, createdAt: true },
          where: { RAW: (table, operators) => (and(
            eq(table.id, input.existingVersionId!),
            eq(table.sourceId, input.sourceId),
            eq(table.status, "draft"),
          )) ?? operators.sql`true` },
        })
      : undefined;
    if (input.existingVersionId && !existingVersion) {
      throw new ApiError(404, "Draft source version not found", undefined, "LEGAL_SOURCE_VERSION_NOT_FOUND");
    }
    const upstreamPublishedAt = input.upstreamPublishedAt
      ? new Date(input.upstreamPublishedAt)
      : undefined;
    const version = existingVersion
      ? upstreamPublishedAt
        ? (await tx
            .update(legalSourceVersions)
            .set({ upstreamPublishedAt })
            .where(eq(legalSourceVersions.id, existingVersion.id))
            .returning())[0]
        : existingVersion
      : (await tx.insert(legalSourceVersions).values({
        sourceId: input.sourceId,
        versionLabel: input.versionLabel,
        officialIdentifier: input.officialIdentifier,
        upstreamUrl: input.upstreamUrl,
        upstreamPublishedAt,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        contentHash: locked.actualSha256,
        createdBy: input.actorUserId,
      }).returning())[0];
    if (!version) throw new ApiError(500, "Could not create source version");
    if (input.translationStatus !== "official") {
      if (!input.authoritativeRenditionId) {
        throw new ApiError(400, "A translated rendition requires its authoritative rendition", undefined, "AUTHORITATIVE_RENDITION_REQUIRED");
      }
      const authoritative = await tx.query.legalSourceRenditions.findFirst({ columns: { id: true, sourceVersionId: true, language: true, translationStatus: true, authoritativeRenditionId: true, storageBucket: true, storagePath: true, mimeType: true, byteSize: true, contentHash: true, duplicateAcknowledged: true, uploadSessionId: true, importJobId: true, importedFromUrl: true, createdBy: true, createdAt: true },
        where: { RAW: (table, operators) => (and(
          eq(table.id, input.authoritativeRenditionId!),
          eq(table.sourceVersionId, version.id),
          eq(table.translationStatus, "official"),
        )) ?? operators.sql`true` },
      });
      if (!authoritative) throw new ApiError(400, "Authoritative rendition does not belong to this version", undefined, "INVALID_AUTHORITATIVE_RENDITION");
    }
    const [rendition] = await tx.insert(legalSourceRenditions).values({
      sourceVersionId: version.id,
      language: input.language,
      translationStatus: input.translationStatus,
      authoritativeRenditionId: input.authoritativeRenditionId,
      storageBucket: locked.bucket,
      storagePath: locked.objectPath,
      mimeType: locked.actualMimeType,
      byteSize: locked.actualSize,
      contentHash: locked.actualSha256,
      duplicateAcknowledged: input.duplicateAcknowledged ?? false,
      uploadSessionId: locked.id,
      createdBy: input.actorUserId,
    }).returning();
    const [job] = await tx.insert(backgroundJobs).values({
      kind: "legal-source-process",
      payload: { renditionId: rendition.id },
      requestedByUserId: input.actorUserId,
      cancellable: true,
    }).returning();
    const [generation] = await tx.insert(legalSourceProcessingGenerations).values({
      renditionId: rendition.id,
      jobId: job.id,
      generationNumber: 1,
      parserConfig: { version: "legal-v1" },
      chunkerConfig: { version: "paragraph-v1" },
      embeddingConfig: { provider: "openai", model: "text-embedding-3-small", dimensions: 1536 },
    }).returning();
    await tx.update(backgroundJobs).set({ payload: { renditionId: rendition.id, generationId: generation.id } }).where(eq(backgroundJobs.id, job.id));
    await tx.update(uploadSessions).set({
      state: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(uploadSessions.id, locked.id));
    await tx.insert(uploadSessionResults).values({
      sessionId: locked.id,
      legalSourceRenditionId: rendition.id,
    });
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_source_rendition.created",
      entityType: "legal_source_rendition",
      entityId: rendition.id,
      requestId: input.requestId,
      metadata: { sourceId: input.sourceId, versionId: version.id, jobId: job.id },
    });
    return { version, rendition, generation, job };
  });
}

async function verifyStoredObject(input: { bucket: string; objectPath: string }) {
  const { data, error } = await getSupabaseAdminClient().storage.from(input.bucket).download(input.objectPath);
  if (error) throw new ApiError(502, "Stored upload could not be read", undefined, "UPLOAD_VERIFICATION_FAILED");
  const bytes = new Uint8Array(await data.arrayBuffer());
  return {
    size: bytes.byteLength,
    mimeType: data.type,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
