import { db } from "@/src/db";
import {
  activeLegalCorpusReleases,
  backgroundJobs,
  legalCorpusReleaseActivations,
  legalCorpusReleaseMembers,
  legalCorpusReleases,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
  platformAuditEvents,
} from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { validateCorpusReleaseMembers } from "./release-validation";

export async function createCorpusRelease(input: { actorUserId: string; familyId: string; versionLabel: string; requestId?: string }) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  return db.transaction(async (tx) => {
    const [release] = await tx.insert(legalCorpusReleases).values({
      familyId: input.familyId,
      versionLabel: input.versionLabel.trim(),
      createdBy: input.actorUserId,
    }).returning();
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_corpus_release.created",
      entityType: "legal_corpus_release",
      entityId: release.id,
      requestId: input.requestId,
      metadata: { familyId: input.familyId, versionLabel: release.versionLabel },
    });
    return release;
  });
}

export async function replaceCorpusReleaseMembers(input: {
  actorUserId: string;
  releaseId: string;
  expectedVersion: number;
  members: Array<{ sourceVersionId: string; renditionId: string; processingGenerationId: string }>;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  return db.transaction(async (tx) => {
    const [release] = await tx.update(legalCorpusReleases).set({ version: input.expectedVersion + 1, updatedAt: new Date() })
      .where(and(eq(legalCorpusReleases.id, input.releaseId), eq(legalCorpusReleases.status, "draft"), eq(legalCorpusReleases.version, input.expectedVersion)))
      .returning();
    if (!release) throw new ApiError(412, "The release changed", undefined, "PRECONDITION_FAILED");
    await tx.delete(legalCorpusReleaseMembers).where(eq(legalCorpusReleaseMembers.releaseId, release.id));
    if (input.members.length) await tx.insert(legalCorpusReleaseMembers).values(input.members.map((member, position) => ({
      releaseId: release.id,
      position,
      ...member,
    })));
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_corpus_release.members_replaced",
      entityType: "legal_corpus_release",
      entityId: release.id,
      requestId: input.requestId,
      metadata: { memberCount: input.members.length, version: release.version },
    });
    return release;
  });
}

export async function publishCorpusRelease(input: { actorUserId: string; releaseId: string; requestId?: string }) {
  await requirePlatformCapability(input.actorUserId, "corpus:publish");
  const release = await db.query.legalCorpusReleases.findFirst({ columns: { id: true, familyId: true, versionLabel: true, contentHash: true, status: true, evaluationState: true, evaluationJobId: true, publishedBy: true, publishedAt: true, withdrawnBy: true, withdrawnAt: true, withdrawalReason: true, version: true, createdBy: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, input.releaseId)) ?? operators.sql`true` } });
  if (!release || release.status !== "draft") throw new ApiError(404, "Draft corpus release not found", undefined, "CORPUS_RELEASE_NOT_FOUND");
  const rows = await db.select({
    position: legalCorpusReleaseMembers.position,
    familyId: legalCorpusReleases.familyId,
    sourceFamilyId: legalSources.familyId,
    sourceVersionStatus: legalSourceVersions.status,
    renditionVersionId: legalSourceRenditions.sourceVersionId,
    sourceVersionId: legalSourceVersions.id,
    translationStatus: legalSourceRenditions.translationStatus,
    authoritativeRenditionId: legalSourceRenditions.authoritativeRenditionId,
    processingRenditionId: legalSourceProcessingGenerations.renditionId,
    renditionId: legalSourceRenditions.id,
    processingState: legalSourceProcessingGenerations.state,
    reliableAnchors: legalSourceProcessingGenerations.reliableAnchors,
    embeddingConfig: legalSourceProcessingGenerations.embeddingConfig,
    contentHash: legalSourceRenditions.contentHash,
  }).from(legalCorpusReleaseMembers)
    .innerJoin(legalCorpusReleases, eq(legalCorpusReleaseMembers.releaseId, legalCorpusReleases.id))
    .innerJoin(legalSourceVersions, eq(legalCorpusReleaseMembers.sourceVersionId, legalSourceVersions.id))
    .innerJoin(legalSources, eq(legalSourceVersions.sourceId, legalSources.id))
    .innerJoin(legalSourceRenditions, eq(legalCorpusReleaseMembers.renditionId, legalSourceRenditions.id))
    .innerJoin(legalSourceProcessingGenerations, eq(legalCorpusReleaseMembers.processingGenerationId, legalSourceProcessingGenerations.id))
    .where(eq(legalCorpusReleaseMembers.releaseId, release.id))
    .orderBy(asc(legalCorpusReleaseMembers.position));
  const validation = validateCorpusReleaseMembers(release.familyId, rows);
  if (!validation.ok) throw new ApiError(422, "Corpus release is not publishable", { errors: validation.errors }, "CORPUS_RELEASE_INVALID");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [published] = await tx.update(legalCorpusReleases).set({
      status: "published", contentHash: validation.contentHash, publishedBy: input.actorUserId, publishedAt: now, updatedAt: now,
    }).where(and(eq(legalCorpusReleases.id, release.id), eq(legalCorpusReleases.status, "draft"))).returning();
    if (!published) throw new ApiError(409, "Corpus release changed", undefined, "CORPUS_RELEASE_CHANGED");
    await tx.update(legalSourceVersions).set({
      status: "published",
      publishedAt: now,
    }).where(and(
      eq(legalSourceVersions.status, "reviewed"),
      inArray(legalSourceVersions.id, rows.map((row) => row.sourceVersionId)),
    ));
    await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_corpus_release.published", entityType: "legal_corpus_release", entityId: published.id, requestId: input.requestId, metadata: { contentHash: published.contentHash } });
    return published;
  });
}

export async function enqueueCorpusEvaluation(input: { actorUserId: string; releaseId: string; requestId?: string }) {
  await requirePlatformCapability(input.actorUserId, "corpus:operate");
  return db.transaction(async (tx) => {
    const release = await tx.query.legalCorpusReleases.findFirst({ columns: { id: true, familyId: true, versionLabel: true, contentHash: true, status: true, evaluationState: true, evaluationJobId: true, publishedBy: true, publishedAt: true, withdrawnBy: true, withdrawnAt: true, withdrawalReason: true, version: true, createdBy: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, input.releaseId)) ?? operators.sql`true` } });
    if (!release || release.status !== "published") throw new ApiError(409, "Only published releases can be evaluated", undefined, "CORPUS_RELEASE_NOT_PUBLISHED");
    const [job] = await tx.insert(backgroundJobs).values({ kind: "grounding-evaluation", payload: { releaseId: release.id }, requestedByUserId: input.actorUserId, cancellable: true }).returning();
    await tx.update(legalCorpusReleases).set({ evaluationState: "pending", evaluationJobId: job.id, updatedAt: new Date() }).where(eq(legalCorpusReleases.id, release.id));
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_corpus_release.evaluation_enqueued",
      entityType: "legal_corpus_release",
      entityId: release.id,
      requestId: input.requestId,
      metadata: { jobId: job.id },
    });
    return job;
  });
}

export async function activateCorpusRelease(input: { actorUserId: string; releaseId: string; emergencyOverrideReason?: string; requestId?: string }) {
  await requirePlatformCapability(input.actorUserId, "corpus:activate");
  return db.transaction(async (tx) => {
    const release = await tx.query.legalCorpusReleases.findFirst({ columns: { id: true, familyId: true, versionLabel: true, contentHash: true, status: true, evaluationState: true, evaluationJobId: true, publishedBy: true, publishedAt: true, withdrawnBy: true, withdrawnAt: true, withdrawalReason: true, version: true, createdBy: true, createdAt: true, updatedAt: true }, where: { RAW: (table, operators) => (eq(table.id, input.releaseId)) ?? operators.sql`true` } });
    if (!release || release.status !== "published") throw new ApiError(409, "Corpus release is not published", undefined, "CORPUS_RELEASE_NOT_PUBLISHED");
    if (release.evaluationState !== "passed" && !input.emergencyOverrideReason?.trim()) throw new ApiError(409, "Corpus evaluation has not passed", undefined, "CORPUS_EVALUATION_REQUIRED");
    const previous = await tx.query.activeLegalCorpusReleases.findFirst({ columns: { familyId: true, releaseId: true, activatedBy: true, activatedAt: true }, where: { RAW: (table, operators) => (eq(table.familyId, release.familyId)) ?? operators.sql`true` } });
    const now = new Date();
    await tx.insert(activeLegalCorpusReleases).values({ familyId: release.familyId, releaseId: release.id, activatedBy: input.actorUserId, activatedAt: now })
      .onConflictDoUpdate({ target: activeLegalCorpusReleases.familyId, set: { releaseId: release.id, activatedBy: input.actorUserId, activatedAt: now } });
    await tx.insert(legalCorpusReleaseActivations).values({ familyId: release.familyId, releaseId: release.id, previousReleaseId: previous?.releaseId, evaluationState: release.evaluationState, emergencyOverrideReason: input.emergencyOverrideReason?.trim(), activatedBy: input.actorUserId, activatedAt: now });
    await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_corpus_release.activated", entityType: "legal_corpus_release", entityId: release.id, requestId: input.requestId, metadata: { previousReleaseId: previous?.releaseId, emergencyOverrideReason: input.emergencyOverrideReason } });
    return release;
  });
}

export async function withdrawCorpusRelease(input: {
  actorUserId: string;
  releaseId: string;
  reason: string;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:publish");
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "A withdrawal reason is required", undefined, "WITHDRAWAL_REASON_REQUIRED");
  return db.transaction(async (tx) => {
    const [release] = await tx.update(legalCorpusReleases).set({
      status: "withdrawn",
      withdrawnBy: input.actorUserId,
      withdrawnAt: new Date(),
      withdrawalReason: reason,
      updatedAt: new Date(),
    }).where(and(eq(legalCorpusReleases.id, input.releaseId), eq(legalCorpusReleases.status, "published"))).returning();
    if (!release) throw new ApiError(409, "Only a published release can be withdrawn", undefined, "CORPUS_RELEASE_NOT_WITHDRAWABLE");
    await tx.insert(platformAuditEvents).values({ actorUserId: input.actorUserId, eventType: "legal_corpus_release.withdrawn", entityType: "legal_corpus_release", entityId: release.id, requestId: input.requestId, metadata: { reason } });
    return release;
  });
}
