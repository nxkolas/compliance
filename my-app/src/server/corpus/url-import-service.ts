import { db } from "@/src/db";
import { backgroundJobs, legalSources, platformAuditEvents } from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { eq } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { validateControlledUrl } from "./controlled-url";

export async function enqueueLegalSourceUrlImport(input: {
  actorUserId: string;
  sourceId: string;
  exactUrl: string;
  versionLabel: string;
  officialIdentifier?: string;
  upstreamPublishedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  language: string;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "corpus:curate");
  const source = await db.query.legalSources.findFirst({ columns: { id: true, familyId: true, stableCode: true, title: true, sourceKind: true, authorityTier: true, canonicalPublisher: true, legalInstrumentId: true, legalProvisionId: true, withdrawnAt: true, withdrawalReason: true, version: true, createdBy: true, createdAt: true, updatedAt: true },
    where: eq(legalSources.id, input.sourceId),
  });
  if (!source || source.withdrawnAt) {
    throw new ApiError(404, "Legal source not found", undefined, "LEGAL_SOURCE_NOT_FOUND");
  }
  const exactUrl = (await validateControlledUrl(input.exactUrl)).toString();
  return db.transaction(async (tx) => {
    const [job] = await tx.insert(backgroundJobs).values({
      kind: "legal-source-import",
      payload: {
        sourceId: source.id,
        exactUrl,
        versionLabel: input.versionLabel,
        officialIdentifier: input.officialIdentifier,
        upstreamPublishedAt: input.upstreamPublishedAt,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        language: input.language,
      },
      requestedByUserId: input.actorUserId,
      cancellable: true,
    }).returning();
    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "legal_source_url_import.enqueued",
      entityType: "background_job",
      entityId: job.id,
      requestId: input.requestId,
      metadata: { sourceId: source.id, exactUrl },
    });
    return job;
  });
}
