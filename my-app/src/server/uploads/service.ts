import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { uploadSessionResults, uploadSessions } from "@/src/db/schema";
import type { UploadSessionDto } from "@/src/contracts/common/uploads";
import { ApiError } from "../api/errors";
import {
  canonicalizeUploadMimeType,
  validateUploadInput,
  type UploadPolicy,
} from "./policy";
import { assertUploadSessionQuota } from "./quota";

export type { UploadPolicy } from "./policy";

export type UploadSigner = (input: {
  bucket: string;
  objectPath: string;
  expiresInSeconds: number;
}) => Promise<string>;

export type UploadedObjectVerifier = (input: {
  bucket: string;
  objectPath: string;
}) => Promise<{ size: number; mimeType: string; sha256: string }>;

export async function createUploadSession(input: {
  organizationId?: string;
  userId: string;
  scope: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
  policy: UploadPolicy;
  signUpload: UploadSigner;
  now?: Date;
}): Promise<UploadSessionDto> {
  const now = input.now ?? new Date();
  validateUploadInput(input.fileName, input.mimeType, input.size, input.sha256, input.policy);
  const [usage] = await db.select({
    count: sql<number>`count(*)::int`,
    bytes: sql<number>`coalesce(sum(${uploadSessions.expectedSize}), 0)::int`,
  }).from(uploadSessions).where(and(
    eq(uploadSessions.createdByUserId, input.userId),
    eq(uploadSessions.scope, input.scope),
    eq(uploadSessions.state, "pending"),
  ));
  assertUploadSessionQuota({ openSessions: usage.count, pendingBytes: usage.bytes, requestedBytes: input.size });
  const objectPath = [
    input.scope,
    input.organizationId ?? "platform",
    randomUUID(),
  ].join("/");
  const expiresAt = new Date(now.getTime() + input.policy.expiresInSeconds * 1000);
  const [session] = await db
    .insert(uploadSessions)
    .values({
      organizationId: input.organizationId,
      createdByUserId: input.userId,
      scope: input.scope,
      bucket: input.policy.bucket,
      objectPath,
      fileName: input.fileName.trim(),
      expectedMimeType: input.mimeType,
      expectedSize: input.size,
      expectedSha256: input.sha256?.toLowerCase(),
      expiresAt,
    })
    .returning();

  try {
    const uploadToken = await input.signUpload({
      bucket: session.bucket,
      objectPath: session.objectPath,
      expiresInSeconds: input.policy.expiresInSeconds,
    });
    return { ...toUploadSessionDto(session), uploadToken };
  } catch (error) {
    await db
      .update(uploadSessions)
      .set({ state: "failed", safeErrorCode: "UPLOAD_TOKEN_FAILED", updatedAt: new Date() })
      .where(eq(uploadSessions.id, session.id));
    throw error;
  }
}


export async function verifyUploadedObject(input: {
  sessionId: string;
  userId: string;
  verifyObject: UploadedObjectVerifier;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const session = await db.query.uploadSessions.findFirst({ columns: { id: true, organizationId: true, createdByUserId: true, scope: true, bucket: true, objectPath: true, fileName: true, expectedMimeType: true, expectedSize: true, expectedSha256: true, actualMimeType: true, actualSize: true, actualSha256: true, state: true, safeErrorCode: true, expiresAt: true, completedAt: true, createdAt: true, updatedAt: true },
    where: { RAW: (table, operators) => (and(eq(table.id, input.sessionId), eq(table.createdByUserId, input.userId))) ?? operators.sql`true` },
  });
  if (!session) throw new ApiError(404, "Upload session not found", undefined, "UPLOAD_SESSION_NOT_FOUND");
  if (session.state === "completed" || session.state === "verified") return session;
  if (session.state !== "pending") {
    throw new ApiError(409, "Upload session cannot be completed", undefined, "UPLOAD_SESSION_INVALID_STATE");
  }
  if (session.expiresAt <= now) {
    await db.update(uploadSessions).set({ state: "expired", updatedAt: now }).where(eq(uploadSessions.id, session.id));
    throw new ApiError(410, "Upload session expired", undefined, "UPLOAD_SESSION_EXPIRED");
  }

  const object = await input.verifyObject({ bucket: session.bucket, objectPath: session.objectPath });
  const objectMimeType = canonicalizeUploadMimeType(object.mimeType);
  if (
    object.size !== session.expectedSize ||
    objectMimeType !== canonicalizeUploadMimeType(session.expectedMimeType) ||
    (session.expectedSha256 && object.sha256.toLowerCase() !== session.expectedSha256)
  ) {
    await db.update(uploadSessions).set({ state: "failed", safeErrorCode: "UPLOAD_OBJECT_MISMATCH", updatedAt: now }).where(eq(uploadSessions.id, session.id));
    throw new ApiError(422, "Uploaded object does not match the session", undefined, "UPLOAD_OBJECT_MISMATCH");
  }

  const [verified] = await db
    .update(uploadSessions)
    .set({
      state: "verified",
      actualMimeType: objectMimeType,
      actualSize: object.size,
      actualSha256: object.sha256.toLowerCase(),
      updatedAt: now,
    })
    .where(and(eq(uploadSessions.id, session.id), eq(uploadSessions.state, "pending")))
    .returning();
  if (!verified) {
    throw new ApiError(409, "Upload session changed", undefined, "UPLOAD_SESSION_CHANGED");
  }
  return verified;
}

export async function markUploadSessionCompleted(input: {
  sessionId: string;
  result: { type: string; id: string };
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const resultValues = toUploadResultValues(input.sessionId, input.result);
  return db.transaction(async (tx) => {
    const [session] = await tx
      .update(uploadSessions)
      .set({
        state: "completed",
        completedAt: now,
        updatedAt: now,
      })
      .where(and(eq(uploadSessions.id, input.sessionId), eq(uploadSessions.state, "verified")))
      .returning();
    if (!session) throw new ApiError(409, "Upload session is not verified", undefined, "UPLOAD_SESSION_NOT_VERIFIED");
    await tx.insert(uploadSessionResults).values(resultValues);
    return session;
  });
}

export async function getUploadSessionResult(sessionId: string) {
  return db.query.uploadSessionResults.findFirst({
    where: { RAW: (table, operators) => (eq(table.sessionId, sessionId)) ?? operators.sql`true` },
    columns: {
      documentVersionId: true,
      legalSourceRenditionId: true,
    },
  });
}

export async function expireUploadSessions(now = new Date()) {
  return db
    .update(uploadSessions)
    .set({ state: "expired", updatedAt: now })
    .where(and(eq(uploadSessions.state, "pending"), lt(uploadSessions.expiresAt, now)))
    .returning({ id: uploadSessions.id, bucket: uploadSessions.bucket, objectPath: uploadSessions.objectPath });
}

export async function listUnreferencedFailedUploads(before: Date) {
  return db
    .select({ id: uploadSessions.id, bucket: uploadSessions.bucket, objectPath: uploadSessions.objectPath })
    .from(uploadSessions)
    .where(and(
      inArray(uploadSessions.state, ["expired", "failed"]),
      lt(uploadSessions.updatedAt, before),
      notExists(
        db.select({ sessionId: uploadSessionResults.sessionId })
          .from(uploadSessionResults)
          .where(eq(uploadSessionResults.sessionId, uploadSessions.id)),
      ),
    ));
}

export function toUploadResultValues(sessionId: string, result: { type: string; id: string }) {
  switch (result.type) {
    case "document_version":
      return { sessionId, documentVersionId: result.id };
    case "legal_source_rendition":
      return { sessionId, legalSourceRenditionId: result.id };
    default:
      throw new ApiError(500, "Unsupported upload result kind", undefined, "UPLOAD_RESULT_KIND_INVALID");
  }
}

function toUploadSessionDto(session: typeof uploadSessions.$inferSelect): UploadSessionDto {
  return {
    id: session.id,
    state: session.state,
    fileName: session.fileName,
    expectedMimeType: session.expectedMimeType,
    expectedSize: session.expectedSize,
    objectPath: session.objectPath,
    expiresAt: session.expiresAt.toISOString(),
  };
}
