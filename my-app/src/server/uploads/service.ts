import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/src/db";
import { uploadSessions } from "@/src/db/schema";
import type { UploadSessionDto } from "@/src/contracts/common/uploads";
import { ApiError } from "../api/errors";
import type { OrganizationScopeExecutor } from "../auth/organization-scope";
import {
  canonicalizeUploadMimeType,
  validateUploadInput,
  type UploadPolicy,
} from "./policy";

export type { UploadPolicy } from "./policy";
export type UploadSigner = (input: { bucket: string; objectPath: string; expiresInSeconds: number }) => Promise<string>;
export type UploadedObjectVerifier = (input: { bucket: string; objectPath: string }) => Promise<{ size: number; mimeType: string; sha256: string }>;
type UploadSessionIdentity = {
  sessionId: string;
  organizationId: string;
  requestedBy: string;
  storageBucket: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  expectedByteSize: number;
  expectedHash: string | null;
  expiresAt: Date;
};

export type PreparedUploadCompletion =
  | (UploadSessionIdentity & {
      kind: "completed";
      resultLocator: unknown;
    })
  | (UploadSessionIdentity & {
      kind: "verified";
      object: {
        byteSize: number;
        mimeType: string;
        contentHash: string;
      };
    });

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
  const session = await prepareUploadSession(input);
  try {
    return await signPreparedUploadSession(
      session,
      input.signUpload,
      input.policy.expiresInSeconds,
    );
  } catch (error) {
    await failPreparedUploadSession(session.id);
    throw error;
  }
}

export async function prepareUploadSession(input: {
  organizationId?: string;
  userId: string;
  scope: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
  policy: UploadPolicy;
  now?: Date;
}, executor: OrganizationScopeExecutor = db) {
  if (!input.organizationId) throw new ApiError(400, "Organization upload scope is required");
  const now = input.now ?? new Date();
  validateUploadInput(input.fileName, input.mimeType, input.size, input.sha256, input.policy);
  const safeFileName = input.fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  const storageKey = `${input.scope}/${input.organizationId}/${randomUUID()}/${safeFileName}`;
  const expiresAt = new Date(now.getTime() + input.policy.expiresInSeconds * 1000);
  const [session] = await executor.insert(uploadSessions).values({
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
  return session;
}

export async function signPreparedUploadSession(
  session: typeof uploadSessions.$inferSelect,
  signUpload: UploadSigner,
  expiresInSeconds: number,
): Promise<UploadSessionDto> {
  const uploadToken = await signUpload({
    bucket: session.storageBucket,
    objectPath: session.storageKey,
    expiresInSeconds,
  });
  return { ...toDto(session), uploadToken };
}

export async function failPreparedUploadSession(
  sessionId: string,
  executor: OrganizationScopeExecutor = db,
) {
  await executor.update(uploadSessions).set({ state: "failed", updatedAt: new Date() })
    .where(eq(uploadSessions.id, sessionId));
}

export async function verifyUploadedObject(input: {
  sessionId: string;
  userId: string;
  organizationId: string;
  verifyObject: UploadedObjectVerifier;
  now?: Date;
}): Promise<PreparedUploadCompletion> {
  const now = input.now ?? new Date();
  const [session] = await db.select().from(uploadSessions).where(and(
    eq(uploadSessions.id, input.sessionId),
    eq(uploadSessions.requestedBy, input.userId),
    eq(uploadSessions.organizationId, input.organizationId),
  ));
  if (!session) throw new ApiError(404, "Upload session not found", undefined, "UPLOAD_SESSION_NOT_FOUND");
  const identity = toCompletionIdentity(session);
  if (session.state === "completed") {
    return { ...identity, kind: "completed", resultLocator: session.resultLocator };
  }
  if (session.state !== "pending" && session.state !== "uploaded") {
    throw new ApiError(409, "Upload session cannot be completed");
  }
  if (session.expiresAt <= now) {
    await db.update(uploadSessions).set({ state: "expired", updatedAt: now })
      .where(and(eq(uploadSessions.id, session.id), inArray(uploadSessions.state, ["pending", "uploaded"])));
    throw new ApiError(410, "Upload session expired", undefined, "UPLOAD_SESSION_EXPIRED");
  }
  const object = await input.verifyObject({ bucket: session.storageBucket, objectPath: session.storageKey });
  const objectMimeType = canonicalizeUploadMimeType(object.mimeType);
  const contentHash = object.sha256.toLowerCase();
  if (
    object.size !== session.expectedByteSize ||
    objectMimeType !== canonicalizeUploadMimeType(session.mimeType) ||
    (session.expectedHash && contentHash !== session.expectedHash)
  ) {
    await db.update(uploadSessions).set({ state: "failed", updatedAt: now })
      .where(and(eq(uploadSessions.id, session.id), inArray(uploadSessions.state, ["pending", "uploaded"])));
    throw new ApiError(422, "Uploaded object does not match the session", undefined, "UPLOAD_OBJECT_MISMATCH");
  }
  if (session.state === "pending") {
    await db.update(uploadSessions).set({ state: "uploaded", updatedAt: now })
      .where(and(eq(uploadSessions.id, session.id), eq(uploadSessions.state, "pending")));
  }
  return {
    ...identity,
    kind: "verified",
    object: {
      byteSize: object.size,
      mimeType: objectMimeType,
      contentHash,
    },
  };
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

function toCompletionIdentity(
  session: typeof uploadSessions.$inferSelect,
): UploadSessionIdentity {
  return {
    sessionId: session.id,
    organizationId: session.organizationId,
    requestedBy: session.requestedBy,
    storageBucket: session.storageBucket,
    storageKey: session.storageKey,
    fileName: session.fileName,
    mimeType: session.mimeType,
    expectedByteSize: session.expectedByteSize,
    expectedHash: session.expectedHash,
    expiresAt: session.expiresAt,
  };
}
