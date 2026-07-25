import { db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalSources,
  platformAuditEvents,
} from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import * as z from "zod";
import { ApiError } from "../api/errors";
import { getCursorCodec } from "../api/pagination";

export async function listCorpusFamilies(userId: string) {
  return (await listCorpusFamiliesPage({ userId, limit: 100 })).families;
}

export async function listCorpusFamiliesPage(input: { userId: string; limit: number; cursor?: string }) {
  await requirePlatformCapability(input.userId, "corpus:read");
  const scope = "corpus-families";
  const cursor = input.cursor ? z.tuple([z.string(), z.uuid()]).parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.legalCorpusFamilies.findMany({ columns: { id: true, code: true, frameworkCode: true, jurisdictionCode: true, title: true, archivedAt: true, version: true, createdBy: true, createdAt: true, updatedAt: true },
    where: { RAW: (table, operators) => (cursor ? or(gt(table.code, cursor[0]), and(eq(table.code, cursor[0]), gt(table.id, cursor[1]))) : undefined) ?? operators.sql`true` },
    orderBy: { code: "asc", id: "asc" },
    limit: input.limit + 1,
  });
  const families = rows.slice(0, input.limit); const last = families.at(-1);
  return { families, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.code, last.id]) : undefined };
}

export async function createCorpusFamily(input: {
  actorUserId: string;
  code: string;
  frameworkCode: string;
  jurisdictionCode: string;
  title: string;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  return db.transaction(async (tx) => {
    const [family] = await tx.insert(legalCorpusFamilies).values({
      code: required(input.code, "code"),
      frameworkCode: required(input.frameworkCode, "frameworkCode"),
      jurisdictionCode: required(input.jurisdictionCode, "jurisdictionCode"),
      title: required(input.title, "title"),
      createdBy: input.actorUserId,
    }).returning();
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_corpus_family.created",
      entityType: "legal_corpus_family",
      entityId: family.id,
      requestId: input.requestId,
      metadata: { code: family.code },
    });
    return family;
  });
}

export async function createLegalSource(input: {
  actorUserId: string;
  familyId: string;
  stableCode: string;
  title: string;
  sourceKind: string;
  authorityTier: "primary_authority" | "official_guidance" | "curated_secondary";
  canonicalPublisher: string;
  legalInstrumentId?: string;
  legalProvisionId?: string;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  const family = await db.query.legalCorpusFamilies.findFirst({ columns: { id: true, code: true, frameworkCode: true, jurisdictionCode: true, title: true, archivedAt: true, version: true, createdBy: true, createdAt: true, updatedAt: true },
    where: { RAW: (table, operators) => (and(eq(table.id, input.familyId), isNull(table.archivedAt))) ?? operators.sql`true` },
  });
  if (!family) throw new ApiError(404, "Corpus family not found", undefined, "CORPUS_FAMILY_NOT_FOUND");
  return db.transaction(async (tx) => {
    const [source] = await tx.insert(legalSources).values({
      familyId: input.familyId,
      stableCode: required(input.stableCode, "stableCode"),
      title: required(input.title, "title"),
      sourceKind: required(input.sourceKind, "sourceKind"),
      authorityTier: input.authorityTier,
      canonicalPublisher: required(input.canonicalPublisher, "canonicalPublisher"),
      legalInstrumentId: input.legalInstrumentId,
      legalProvisionId: input.legalProvisionId,
      createdBy: input.actorUserId,
    }).returning();
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_source.created",
      entityType: "legal_source",
      entityId: source.id,
      requestId: input.requestId,
      metadata: { familyId: input.familyId, stableCode: source.stableCode },
    });
    return source;
  });
}

export async function withdrawLegalSource(input: {
  actorUserId: string;
  sourceId: string;
  expectedVersion: number;
  reason: string;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [source] = await tx.update(legalSources).set({
      withdrawnAt: now,
      withdrawalReason: required(input.reason, "reason"),
      version: input.expectedVersion + 1,
      updatedAt: now,
    }).where(and(
      eq(legalSources.id, input.sourceId),
      eq(legalSources.version, input.expectedVersion),
      isNull(legalSources.withdrawnAt),
    )).returning();
    if (!source) throw new ApiError(412, "The source changed", undefined, "PRECONDITION_FAILED");
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_source.withdrawn",
      entityType: "legal_source",
      entityId: source.id,
      requestId: input.requestId,
      metadata: { reason: input.reason },
    });
    return source;
  });
}

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new ApiError(400, `${field} is required`, undefined, "INVALID_REQUEST");
  return normalized;
}
