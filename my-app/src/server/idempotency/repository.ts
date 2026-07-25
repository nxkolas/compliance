import { idempotencyRecordResults, idempotencyRecords } from "@/src/db/schema";
import type { IdempotencyRecord, IdempotencyRepository, IdempotencyResultType } from "@/src/server/api/idempotency";
import { and, eq } from "drizzle-orm";

export const databaseIdempotencyRepository: IdempotencyRepository = {
  async create(record) {
    const { db } = await import("@/src/db");
    const inserted = await db
      .insert(idempotencyRecords)
      .values({
        actorKey: record.actorKey,
        organizationId: record.organizationId,
        scope: record.scope,
        operation: record.operation,
        key: record.key,
        requestFingerprint: record.requestFingerprint,
        state: record.state,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing()
      .returning({ id: idempotencyRecords.id });
    return inserted.length === 1;
  },

  async find(input) {
    const { db } = await import("@/src/db");
    const row = await db.query.idempotencyRecords.findFirst({
      where: claimWhere(input),
      columns: {
        id: true,
        actorKey: true,
        organizationId: true,
        scope: true,
        operation: true,
        key: true,
        requestFingerprint: true,
        state: true,
        responseStatus: true,
      },
    });
    if (!row) return null;
    const result = await db.query.idempotencyRecordResults.findFirst({
      where: eq(idempotencyRecordResults.recordId, row.id),
      columns: {
        recordId: true,
        platformAdministratorUserId: true,
        legalCorpusFamilyId: true,
        backgroundJobId: true,
        legalProcessingGenerationId: true,
        legalCorpusReleaseId: true,
        legalSourceRenditionId: true,
        legalSourceId: true,
        generatedArtifactRevisionId: true,
        assessmentId: true,
        assessmentRevisionId: true,
        gapReassessmentDraftId: true,
        organizationInvitationId: true,
        organizationId: true,
        actionPlanId: true,
        reportId: true,
        documentVersionId: true,
      },
    });
    return toRecord(row, result ?? null);
  },

  async save(record) {
    const { db } = await import("@/src/db");
    await db.transaction(async (tx) => {
      const [saved] = await tx
        .update(idempotencyRecords)
        .set({
          state: record.state,
          responseStatus: record.responseStatus,
          updatedAt: new Date(),
        })
        .where(claimWhere(record))
        .returning({ id: idempotencyRecords.id });
      if (!saved) return;
      await tx.delete(idempotencyRecordResults)
        .where(eq(idempotencyRecordResults.recordId, saved.id));
      if (record.resultReference) {
        await tx.insert(idempotencyRecordResults)
          .values(toResultValues(saved.id, record.resultReference));
      }
    });
  },
};

function claimWhere(
  input: Pick<IdempotencyRecord, "actorKey" | "scope" | "operation" | "key">,
) {
  return and(
    eq(idempotencyRecords.actorKey, input.actorKey),
    eq(idempotencyRecords.scope, input.scope),
    eq(idempotencyRecords.operation, input.operation),
    eq(idempotencyRecords.key, input.key),
  );
}

function toRecord(
  row: Pick<typeof idempotencyRecords.$inferSelect,
    "actorKey" | "organizationId" | "scope" | "operation" | "key" | "requestFingerprint" | "state" | "responseStatus">,
  result: Omit<typeof idempotencyRecordResults.$inferSelect, "createdAt"> | null,
): IdempotencyRecord {
  return {
    actorKey: row.actorKey,
    organizationId: row.organizationId ?? undefined,
    scope: row.scope,
    operation: row.operation,
    key: row.key,
    requestFingerprint: row.requestFingerprint,
    state: row.state,
    responseStatus: row.responseStatus ?? undefined,
    resultReference: result ? toResultReference(result) : undefined,
  };
}

function toResultValues(
  recordId: string,
  result: { type: IdempotencyResultType; id: string },
) {
  switch (result.type) {
    case "platform_administrator": return { recordId, platformAdministratorUserId: result.id };
    case "legal_corpus_family": return { recordId, legalCorpusFamilyId: result.id };
    case "background_job": return { recordId, backgroundJobId: result.id };
    case "legal_processing_generation": return { recordId, legalProcessingGenerationId: result.id };
    case "legal_corpus_release": return { recordId, legalCorpusReleaseId: result.id };
    case "legal_source_rendition": return { recordId, legalSourceRenditionId: result.id };
    case "legal_source": return { recordId, legalSourceId: result.id };
    case "generated_artifact_revision": return { recordId, generatedArtifactRevisionId: result.id };
    case "assessment": return { recordId, assessmentId: result.id };
    case "assessment_revision": return { recordId, assessmentRevisionId: result.id };
    case "gap_reassessment_draft": return { recordId, gapReassessmentDraftId: result.id };
    case "organization_invitation": return { recordId, organizationInvitationId: result.id };
    case "organization": return { recordId, organizationId: result.id };
    case "action_plan": return { recordId, actionPlanId: result.id };
    case "report": return { recordId, reportId: result.id };
    case "document_version": return { recordId, documentVersionId: result.id };
  }
}

function toResultReference(
  result: Omit<typeof idempotencyRecordResults.$inferSelect, "createdAt">,
): { type: IdempotencyResultType; id: string } {
  if (result.platformAdministratorUserId) return { type: "platform_administrator", id: result.platformAdministratorUserId };
  if (result.legalCorpusFamilyId) return { type: "legal_corpus_family", id: result.legalCorpusFamilyId };
  if (result.backgroundJobId) return { type: "background_job", id: result.backgroundJobId };
  if (result.legalProcessingGenerationId) return { type: "legal_processing_generation", id: result.legalProcessingGenerationId };
  if (result.legalCorpusReleaseId) return { type: "legal_corpus_release", id: result.legalCorpusReleaseId };
  if (result.legalSourceRenditionId) return { type: "legal_source_rendition", id: result.legalSourceRenditionId };
  if (result.legalSourceId) return { type: "legal_source", id: result.legalSourceId };
  if (result.generatedArtifactRevisionId) return { type: "generated_artifact_revision", id: result.generatedArtifactRevisionId };
  if (result.assessmentId) return { type: "assessment", id: result.assessmentId };
  if (result.assessmentRevisionId) return { type: "assessment_revision", id: result.assessmentRevisionId };
  if (result.gapReassessmentDraftId) return { type: "gap_reassessment_draft", id: result.gapReassessmentDraftId };
  if (result.organizationInvitationId) return { type: "organization_invitation", id: result.organizationInvitationId };
  if (result.organizationId) return { type: "organization", id: result.organizationId };
  if (result.actionPlanId) return { type: "action_plan", id: result.actionPlanId };
  if (result.reportId) return { type: "report", id: result.reportId };
  if (result.documentVersionId) return { type: "document_version", id: result.documentVersionId };
  throw new Error("Idempotency result violates the exactly-one invariant");
}
