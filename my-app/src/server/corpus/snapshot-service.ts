import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalCorpusSnapshotMembers,
  legalCorpusSnapshots,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
  platformAuditEvents,
} from "@/src/db/schema";
import { contentHash } from "@/src/server/compliance/domain";

export async function activateLegalCorpusSnapshot(input: {
  operatorIdentity: string;
  familyCode: string;
  processingGenerationIds: string[];
  requestId?: string;
}) {
  const generationIds = [...new Set(input.processingGenerationIds)];
  if (!input.operatorIdentity.trim()) throw new Error("Operator identity is required");
  if (!generationIds.length || generationIds.length !== input.processingGenerationIds.length) {
    throw new Error("Processing generation IDs must be unique and non-empty");
  }
  return db.transaction(async (tx) => {
    const [family] = await tx.select().from(legalCorpusFamilies)
      .where(eq(legalCorpusFamilies.code, input.familyCode)).limit(1).for("update");
    if (!family) throw new Error(`Unknown legal corpus family: ${input.familyCode}`);
    const members = await tx.select({
      sourceVersionId: legalSourceVersions.id,
      renditionId: legalSourceRenditions.id,
      processingGenerationId: legalSourceProcessingGenerations.id,
      status: legalSourceProcessingGenerations.status,
      familyId: legalSources.familyId,
    }).from(legalSourceProcessingGenerations)
      .innerJoin(legalSourceVersions, eq(legalSourceProcessingGenerations.sourceVersionId, legalSourceVersions.id))
      .innerJoin(legalSources, and(eq(legalSourceVersions.sourceId, legalSources.id), eq(legalSourceVersions.familyId, legalSources.familyId)))
      .innerJoin(legalSourceRenditions, and(
        eq(legalSourceProcessingGenerations.renditionId, legalSourceRenditions.id),
        eq(legalSourceRenditions.sourceVersionId, legalSourceVersions.id),
      ))
      .where(inArray(legalSourceProcessingGenerations.id, generationIds));
    if (members.length !== generationIds.length) throw new Error("A processing generation does not exist or has invalid lineage");
    if (members.some((member) => member.familyId !== family.id)) throw new Error("Snapshot members must belong to one corpus family");
    if (members.some((member) => member.status !== "succeeded")) throw new Error("Every snapshot member must have succeeded processing");
    const ordered = [...members].sort((left, right) => left.sourceVersionId.localeCompare(right.sourceVersionId));
    if (new Set(ordered.map((member) => member.sourceVersionId)).size !== ordered.length) {
      throw new Error("A snapshot may include only one processing generation per source version");
    }
    const hash = contentHash(ordered.map((member) => ({
      sourceVersionId: member.sourceVersionId,
      renditionId: member.renditionId,
      processingGenerationId: member.processingGenerationId,
    })));
    const [snapshot] = await tx.insert(legalCorpusSnapshots).values({
      familyId: family.id,
      contentHash: hash,
      validatedBy: input.operatorIdentity,
    }).returning();
    if (!snapshot) throw new Error("Could not create corpus snapshot");
    await tx.insert(legalCorpusSnapshotMembers).values(ordered.map((member, position) => ({
      snapshotId: snapshot.id,
      sourceVersionId: member.sourceVersionId,
      renditionId: member.renditionId,
      processingGenerationId: member.processingGenerationId,
      position,
    })));
    await tx.update(legalCorpusFamilies).set({ currentSnapshotId: snapshot.id, updatedAt: new Date() })
      .where(eq(legalCorpusFamilies.id, family.id));
    await tx.insert(platformAuditEvents).values({
      operatorIdentity: input.operatorIdentity,
      eventType: "legal_corpus_snapshot.activated",
      entityType: "legal_corpus_snapshot",
      entityId: snapshot.id,
      requestId: input.requestId,
      metadata: { familyCode: family.code, contentHash: hash, memberCount: ordered.length },
    });
    return snapshot;
  });
}
