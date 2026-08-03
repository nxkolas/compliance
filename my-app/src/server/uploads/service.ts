import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/src/db";
import { uploadSessions } from "@/src/db/schema";
import type { UploadSessionDto } from "@/src/contracts/common/uploads";
import { ApiError } from "../api/errors";
import {
  canonicalizeUploadMimeType,
  validateUploadInput,
  type UploadPolicy,
} from "./policy";

export type { UploadPolicy } from "./policy";
export type UploadSigner = (input: { bucket: string; objectPath: string; expiresInSeconds: number }) => Promise<string>;
export type UploadedObjectVerifier = (input: { bucket: string; objectPath: string }) => Promise<{ size: number; mimeType: string; sha256: string }>;

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
  if (!input.organizationId) throw new ApiError(400, "Organization upload scope is required");
  const now = input.now ?? new Date();
  validateUploadInput(input.fileName, input.mimeType, input.size, input.sha256, input.policy);
  const safeFileName = input.fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  const storageKey = `${input.scope}/${input.organizationId}/${randomUUID()}/${safeFileName}`;
  const expiresAt = new Date(now.getTime() + input.policy.expiresInSeconds * 1000);
  const [session] = await db.insert(uploadSessions).values({
    organizationId: input.organizationId,
    storageBucket: input.policy.bucket,
    storageKey,
    fileName: input.fileName.trim(),
    mimeType: input.mimeType,
    expectedByteSize: input.size,
    expectedHash: input.sha256?.toLowerCase(),
    requestedBy: input.userId,
    expiresAt,
  }).returning();
  if (!session) throw new Error("Upload session was not created");
  try {
    const uploadToken = await input.signUpload({
      bucket: session.storageBucket,
      objectPath: session.storageKey,
      expiresInSeconds: input.policy.expiresInSeconds,
    });
    return { ...toDto(session), uploadToken };
  } catch (error) {
    await db.update(uploadSessions).set({ state: "failed", updatedAt: new Date() }).where(eq(uploadSessions.id, session.id));
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
  const session = await db.query.uploadSessions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, input.sessionId), eq(table.requestedBy, input.userId)) ?? operators.sql`true` },
  });
  if (!session) throw new ApiError(404, "Upload session not found", undefined, "UPLOAD_SESSION_NOT_FOUND");
  if (session.state === "completed" || session.state === "uploaded") return session;
  if (session.state !== "pending") throw new ApiError(409, "Upload session cannot be completed");
  if (session.expiresAt <= now) {
    await db.update(uploadSessions).set({ state: "expired", updatedAt: now }).where(eq(uploadSessions.id, session.id));
    throw new ApiError(410, "Upload session expired", undefined, "UPLOAD_SESSION_EXPIRED");
  }
  const object = await input.verifyObject({ bucket: session.storageBucket, objectPath: session.storageKey });
  if (
    object.size !== session.expectedByteSize ||
    canonicalizeUploadMimeType(object.mimeType) !== canonicalizeUploadMimeType(session.mimeType) ||
    (session.expectedHash && object.sha256.toLowerCase() !== session.expectedHash)
  ) {
    await db.update(uploadSessions).set({ state: "failed", updatedAt: now }).where(eq(uploadSessions.id, session.id));
    throw new ApiError(422, "Uploaded object does not match the session", undefined, "UPLOAD_OBJECT_MISMATCH");
  }
  const [uploaded] = await db.update(uploadSessions).set({ state: "uploaded", updatedAt: now })
    .where(and(eq(uploadSessions.id, session.id), eq(uploadSessions.state, "pending"))).returning();
  if (!uploaded) throw new ApiError(409, "Upload session changed");
  return uploaded;
}

export async function markUploadSessionCompleted(input: {
  sessionId: string;
  result: { type: string; id: string };
  now?: Date;
}) {
  const [session] = await db.update(uploadSessions).set({
    state: "completed",
    resultLocator: input.result,
    updatedAt: input.now ?? new Date(),
  }).where(and(eq(uploadSessions.id, input.sessionId), eq(uploadSessions.state, "uploaded"))).returning();
  if (!session) throw new ApiError(409, "Upload session is not uploaded");
  return session;
}

export async function getUploadSessionResult(sessionId: string) {
  const session = await db.query.uploadSessions.findFirst({
    columns: { resultLocator: true },
    where: { RAW: (table, operators) => eq(table.id, sessionId) ?? operators.sql`true` },
  });
  return session?.resultLocator ?? null;
}

export function expireUploadSessions(now = new Date()) {
  return db.update(uploadSessions).set({ state: "expired", updatedAt: now })
    .where(and(inArray(uploadSessions.state, ["pending", "uploaded"]), lt(uploadSessions.expiresAt, now)))
    .returning({ id: uploadSessions.id, bucket: uploadSessions.storageBucket, objectPath: uploadSessions.storageKey });
}

export function listUnreferencedFailedUploads(before: Date) {
  return db.select({ id: uploadSessions.id, bucket: uploadSessions.storageBucket, objectPath: uploadSessions.storageKey })
    .from(uploadSessions)
    .where(and(inArray(uploadSessions.state, ["expired", "failed"]), lt(uploadSessions.updatedAt, before)));
}

export function toUploadResultValues(_sessionId: string, result: { type: string; id: string }) {
  return result;
}

function toDto(session: typeof uploadSessions.$inferSelect): UploadSessionDto {
  return {
    id: session.id,
    state: session.state,
    fileName: session.fileName,
    mimeType: session.mimeType,
    expectedByteSize: session.expectedByteSize,
    storageKey: session.storageKey,
    expiresAt: session.expiresAt.toISOString(),
  };
}
