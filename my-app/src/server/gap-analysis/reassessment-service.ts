import { db } from "@/src/db";
import {
  aiProcessingRuns,
  artifactRevisionSources,
  assessmentRevisions,
  assessments,
  auditEvents,
  backgroundJobs,
  documentEmbeddingGenerations,
  documentExtractions,
  documentVersions,
  documents,
  gapReassessmentDraftDocuments,
  gapReassessmentDrafts,
  generatedArtifactRevisions,
  generatedArtifacts,
  idempotencyRecords,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ApiError } from "../api/errors";
import {
  assertCanAccessOrganization,
  assertCanContributeToOrganization,
} from "../organizations/service";
import { generateGapAnalysis } from "./generation-service";
import { loadGapAnalysisRelease } from "./release-loader";
import { buildReassessmentEvidenceSelection } from "./reassessment-selection";
import { fingerprintRequest } from "../api/idempotency";
import { toJobDto } from "../jobs/service";
import { retryableGapReassessmentStatuses } from "@/src/contracts/gap-analysis/generation";
import type { LoadedGapRelease } from "./release-loader";
import { assertGapInputsMutable } from "./lifecycle-guards";

export async function prepareGapReassessment(input: {
  userId: string;
  organizationId: string;
  assessmentId: string;
  selectedDocumentVersionIds: string[];
  locale: Locale;
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const context = await loadPreparationContext(input.organizationId, input.assessmentId);
  await assertGapInputsMutable({
    organizationId: input.organizationId,
    moduleId: context.assessment.moduleId,
  });
  const existing = await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.assessmentId, context.assessment.id),
      eq(gapReassessmentDrafts.status, "open"),
    ),
  });
  if (existing) {
    await updateGapReassessmentEvidence({
      userId: input.userId,
      organizationId: input.organizationId,
      draftId: existing.id,
      expectedLockVersion: existing.lockVersion,
      selectedDocumentVersionIds: input.selectedDocumentVersionIds,
    });
    return getGapReassessmentDraft({
      userId: input.userId,
      organizationId: input.organizationId,
      draftId: existing.id,
      locale: input.locale,
    });
  }

  const baseDocuments = await loadAcceptedEvidence(context.artifact?.acceptedRevisionId);
  const selection = await resolveEvidenceSelection({
    organizationId: input.organizationId,
    accepted: baseDocuments,
    explicitAdditions: input.selectedDocumentVersionIds,
  });
  if (selection.blocked.length) {
    throw new ApiError(
      409,
      "Current versions of all selected evidence must be indexed before reassessment",
      { documentVersionIds: selection.blocked },
      "GAP_DOCUMENT_NOT_READY",
    );
  }
  const [draft] = await db.transaction(async (tx) => {
    const created = await tx
      .insert(gapReassessmentDrafts)
      .values({
        organizationId: input.organizationId,
        assessmentId: context.assessment.id,
        gapAnalysisReleaseId: context.assessment.gapAnalysisReleaseId!,
        baseAcceptedGapRevisionId: context.artifact?.acceptedRevisionId,
        assessmentRevisionId: context.assessment.currentRevisionId!,
        createdBy: input.userId,
      })
      .onConflictDoNothing()
      .returning();
    const createdDraft = created[0];
    if (!createdDraft) return [];
    await lockEligibleEvidenceSelection(
      tx,
      input.organizationId,
      selection.selection,
    );
    if (selection.selection.length) {
      await tx.insert(gapReassessmentDraftDocuments).values(
        selection.selection.map((item) => ({
          draftId: createdDraft.id,
          organizationId: input.organizationId,
          documentId: item.documentId,
          documentVersionId: item.versionId,
          selectionOrigin: item.origin,
          selectedBy: input.userId,
        })),
      );
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_reassessment.prepared",
      entityType: "gap_reassessment_draft",
      entityId: createdDraft.id,
      metadata: {
        baseAcceptedGapRevisionId: context.artifact?.acceptedRevisionId ?? null,
        selectedDocumentVersionIds: selection.selection.map((item) => item.versionId),
        removedDocumentVersionIds: selection.removed,
      },
    });
    return created;
  });
  if (!draft) {
    const concurrent = await db.query.gapReassessmentDrafts.findFirst({
      where: and(
        eq(gapReassessmentDrafts.assessmentId, context.assessment.id),
        eq(gapReassessmentDrafts.status, "open"),
      ),
    });
    if (!concurrent) {
      throw new ApiError(
        409,
        "The shared analysis inputs changed",
        undefined,
        "GAP_DRAFT_CHANGED",
      );
    }
    throw new ApiError(
      409,
      "Another contributor prepared the shared analysis inputs",
      { draftId: concurrent.id },
      "GAP_DRAFT_CHANGED",
    );
  }
  return getGapReassessmentDraft({
    userId: input.userId,
    organizationId: input.organizationId,
    draftId: draft.id,
    locale: input.locale,
  });
}

export async function updateGapReassessmentEvidence(input: {
  userId: string;
  organizationId: string;
  draftId: string;
  expectedLockVersion: number;
  selectedDocumentVersionIds: string[];
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const draft = await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.id, input.draftId),
      eq(gapReassessmentDrafts.organizationId, input.organizationId),
    ),
  });
  if (!draft || draft.status !== "open") {
    throw new ApiError(
      409,
      "Only open analysis inputs can be edited",
      undefined,
      "GAP_DRAFT_NOT_OPEN",
    );
  }
  const assessment = await db.query.assessments.findFirst({
    where: and(
      eq(assessments.id, draft.assessmentId),
      eq(assessments.organizationId, input.organizationId),
    ),
  });
  if (!assessment) throw new ApiError(404, "Gap assessment not found");
  await assertGapInputsMutable({
    organizationId: input.organizationId,
    moduleId: assessment.moduleId,
  });
  const baseDocuments = await loadAcceptedEvidence(draft.baseAcceptedGapRevisionId);
  const selection = await resolveEvidenceSelection({
    organizationId: input.organizationId,
    accepted: baseDocuments,
    explicitAdditions: input.selectedDocumentVersionIds,
  });
  if (selection.blocked.length) {
    throw new ApiError(
      409,
      "Selected documents must have a current indexed version",
      { documentVersionIds: selection.blocked },
      "GAP_DOCUMENT_NOT_READY",
    );
  }
  const updated = await db.transaction(async (tx) => {
    const [locked] = await tx
      .update(gapReassessmentDrafts)
      .set({
        lockVersion: input.expectedLockVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(gapReassessmentDrafts.id, draft.id),
          eq(gapReassessmentDrafts.status, "open"),
          eq(gapReassessmentDrafts.lockVersion, input.expectedLockVersion),
        ),
      )
      .returning();
    if (!locked) {
      throw new ApiError(
        409,
        "The shared analysis inputs changed in another session",
        undefined,
        "GAP_DRAFT_CHANGED",
      );
    }
    await lockEligibleEvidenceSelection(
      tx,
      input.organizationId,
      selection.selection,
    );
    await tx
      .delete(gapReassessmentDraftDocuments)
      .where(eq(gapReassessmentDraftDocuments.draftId, draft.id));
    if (selection.selection.length) {
      await tx.insert(gapReassessmentDraftDocuments).values(
        selection.selection.map((item) => ({
          draftId: draft.id,
          organizationId: input.organizationId,
          documentId: item.documentId,
          documentVersionId: item.versionId,
          selectionOrigin: item.origin,
          selectedBy: input.userId,
        })),
      );
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_reassessment.evidence_updated",
      entityType: "gap_reassessment_draft",
      entityId: draft.id,
      metadata: {
        lockVersion: input.expectedLockVersion + 1,
        selectedDocumentVersionIds: selection.selection.map((item) => item.versionId),
      },
    });
    return locked;
  });
  return updated;
}

type GapReassessmentDraftLookup = {
  organizationId: string;
  draftId?: string;
  assessmentId?: string;
};

export type GapReassessmentDraftReadInput = GapReassessmentDraftLookup & {
  locale: Locale;
  release?: LoadedGapRelease;
};

type AuthorizedGapReassessmentDraftReadInput =
  GapReassessmentDraftReadInput & {
    userId: string;
  };

export function createGapReassessmentDraftReader<
  TDraft extends {
    id: string;
    assessmentId: string;
    assessmentRevisionId: string;
    gapAnalysisReleaseId: string;
    baseAcceptedGapRevisionId: string | null;
  },
  TSelected extends {
    documentId: string;
    documentVersionId: string;
    selectionOrigin:
      | "approved_carryover"
      | "version_replacement"
      | "explicit_addition";
  },
  TBaseRevision extends { revisionNumber: number } | null | undefined,
  TAssessmentRevision extends { revisionNumber: number } | null | undefined,
  TAssessment extends {
    applicabilityArtifactRevisionId: string | null;
  } | null | undefined,
  TApplicabilityRevision extends { result: unknown } | null | undefined,
>(dependencies: {
  authorize: (input: {
    userId: string;
    organizationId: string;
  }) => Promise<void>;
  findDraft: (
    input: GapReassessmentDraftLookup,
  ) => Promise<TDraft | null | undefined>;
  loadSelected: (draftId: string) => Promise<TSelected[]>;
  loadAcceptedEvidence: (
    acceptedRevisionId: string | null,
  ) => Promise<Array<{ versionId: string; documentId: string }>>;
  loadRelease: (
    releaseId: string,
    locale: Locale,
  ) => Promise<LoadedGapRelease | null>;
  loadBaseRevision: (
    revisionId: string | null,
  ) => Promise<TBaseRevision>;
  loadAssessmentRevision: (
    revisionId: string,
  ) => Promise<TAssessmentRevision>;
  loadAssessment: (assessmentId: string) => Promise<TAssessment>;
  loadApplicabilityRevision: (
    revisionId: string | null,
  ) => Promise<TApplicabilityRevision>;
}) {
  const getPreauthorized = async (input: GapReassessmentDraftReadInput) => {
    const draft = await dependencies.findDraft(input);
    if (!draft) return null;
    const release =
      input.release?.id === draft.gapAnalysisReleaseId
        ? Promise.resolve(input.release)
        : dependencies.loadRelease(draft.gapAnalysisReleaseId, input.locale);
    const [
      selected,
      base,
      resolvedRelease,
      baseRevision,
      assessmentRevision,
      assessment,
    ] = await Promise.all([
      dependencies.loadSelected(draft.id),
      dependencies.loadAcceptedEvidence(draft.baseAcceptedGapRevisionId),
      release,
      dependencies.loadBaseRevision(draft.baseAcceptedGapRevisionId),
      dependencies.loadAssessmentRevision(draft.assessmentRevisionId),
      dependencies.loadAssessment(draft.assessmentId),
    ]);
    const selectedIds = new Set(
      selected.map((item) => item.documentVersionId),
    );
    const selectedDocumentIds = new Set(
      selected.map((item) => item.documentId),
    );
    const applicability = assessment?.applicabilityArtifactRevisionId
      ? await dependencies.loadApplicabilityRevision(
          assessment.applicabilityArtifactRevisionId,
        )
      : null;
    let requirementCount = 0;
    const outcome = (applicability?.result as { outcome?: unknown } | undefined)
      ?.outcome;
    if (resolvedRelease && typeof outcome === "string") {
      requirementCount = resolvedRelease.requirements.filter((requirement) =>
        requirement.applicabilityOutcomeCodes.includes(outcome),
      ).length;
    }
    return {
      draft,
      selected,
      summary: {
        baseAcceptedGapRevisionId: draft.baseAcceptedGapRevisionId,
        baseAcceptedGapRevisionNumber: baseRevision?.revisionNumber ?? null,
        assessmentRevisionId: draft.assessmentRevisionId,
        assessmentRevisionNumber: assessmentRevision?.revisionNumber ?? null,
        gapAnalysisReleaseId: draft.gapAnalysisReleaseId,
        gapAnalysisReleaseVersion: resolvedRelease?.versionLabel ?? null,
        requirementCount,
        carried: selected
          .filter((item) => item.selectionOrigin === "approved_carryover")
          .map((item) => item.documentVersionId),
        replaced: selected
          .filter((item) => item.selectionOrigin === "version_replacement")
          .map((item) => item.documentVersionId),
        added: selected
          .filter((item) => item.selectionOrigin === "explicit_addition")
          .map((item) => item.documentVersionId),
        removed: base
          .filter((item) => !selectedDocumentIds.has(item.documentId))
          .map((item) => item.versionId),
        selectedDocumentVersionIds: [...selectedIds],
      },
    };
  };

  return {
    getPreauthorized,
    async getAuthorized(input: AuthorizedGapReassessmentDraftReadInput) {
      await dependencies.authorize(input);
      return getPreauthorized(input);
    },
  };
}

export async function getGapReassessmentDraft(input: {
  userId: string;
  organizationId: string;
  draftId?: string;
  assessmentId?: string;
  locale: Locale;
}) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  return readGapReassessmentDraftSnapshotPreauthorized(input);
}

export async function getGapReassessmentDraftPreauthorized(
  input: GapReassessmentDraftReadInput,
) {
  return readGapReassessmentDraftSnapshotPreauthorized(input);
}

async function readGapReassessmentDraftSnapshotPreauthorized(
  input: GapReassessmentDraftReadInput,
) {
  const baseRevision = alias(
    generatedArtifactRevisions,
    "reassessment_base_revision",
  );
  const applicabilityRevision = alias(
    generatedArtifactRevisions,
    "reassessment_applicability_revision",
  );
  const draftWhere = and(
    eq(gapReassessmentDrafts.organizationId, input.organizationId),
    input.draftId
      ? eq(gapReassessmentDrafts.id, input.draftId)
      : undefined,
    input.assessmentId
      ? eq(gapReassessmentDrafts.assessmentId, input.assessmentId)
      : undefined,
  );
  const metadataPromise = db
    .select({
      draft: gapReassessmentDrafts,
      baseAcceptedGapRevisionNumber: baseRevision.revisionNumber,
      assessmentRevisionNumber: assessmentRevisions.revisionNumber,
      applicabilityResult: applicabilityRevision.result,
    })
    .from(gapReassessmentDrafts)
    .leftJoin(
      baseRevision,
      eq(baseRevision.id, gapReassessmentDrafts.baseAcceptedGapRevisionId),
    )
    .leftJoin(
      assessmentRevisions,
      eq(
        assessmentRevisions.id,
        gapReassessmentDrafts.assessmentRevisionId,
      ),
    )
    .leftJoin(
      assessments,
      eq(assessments.id, gapReassessmentDrafts.assessmentId),
    )
    .leftJoin(
      applicabilityRevision,
      eq(
        applicabilityRevision.id,
        assessments.applicabilityArtifactRevisionId,
      ),
    )
    .where(draftWhere)
    .orderBy(desc(gapReassessmentDrafts.createdAt))
    .limit(1);
  const evidencePromise = db.execute<{
    row_kind: "selected" | "base";
    draft_id: string | null;
    organization_id: string | null;
    document_id: string;
    document_version_id: string;
    selection_origin:
      | "approved_carryover"
      | "version_replacement"
      | "explicit_addition"
      | null;
    selected_by: string | null;
    selected_at: Date | null;
  }>(sql`
    with latest_draft as (
      select draft.*
      from gap_reassessment_drafts draft
      where draft.organization_id = ${input.organizationId}
        ${input.draftId ? sql`and draft.id = ${input.draftId}` : sql``}
        ${input.assessmentId
          ? sql`and draft.assessment_id = ${input.assessmentId}`
          : sql``}
      order by draft.created_at desc
      limit 1
    )
    select
      'selected'::text as row_kind,
      selected.draft_id,
      selected.organization_id,
      selected.document_id,
      selected.document_version_id,
      selected.selection_origin::text as selection_origin,
      selected.selected_by,
      selected.selected_at
    from latest_draft draft
    inner join gap_reassessment_draft_documents selected
      on selected.draft_id = draft.id
    union all
    select
      'base'::text as row_kind,
      null::uuid as draft_id,
      null::uuid as organization_id,
      version.document_id,
      version.id as document_version_id,
      null::text as selection_origin,
      null::uuid as selected_by,
      null::timestamptz as selected_at
    from latest_draft draft
    inner join artifact_revision_sources source
      on source.artifact_revision_id = draft.base_accepted_gap_revision_id
      and source.source_type = 'document_version'
    inner join document_versions version
      on version.id = source.source_id
  `);
  const [[metadata], evidenceRows] = await Promise.all([
    metadataPromise,
    evidencePromise,
  ]);
  if (!metadata) return null;

  const draft = metadata.draft;
  const resolvedRelease =
    input.release?.id === draft.gapAnalysisReleaseId
      ? input.release
      : await loadGapAnalysisRelease(
          draft.gapAnalysisReleaseId,
          input.locale,
        );
  const selected = evidenceRows
    .filter((row) => row.row_kind === "selected")
    .map((row) => ({
      draftId: row.draft_id!,
      organizationId: row.organization_id!,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      selectionOrigin: row.selection_origin!,
      selectedBy: row.selected_by!,
      selectedAt: row.selected_at!,
    }));
  const base = evidenceRows
    .filter((row) => row.row_kind === "base")
    .map((row) => ({
      versionId: row.document_version_id,
      documentId: row.document_id,
    }));
  const selectedIds = new Set(
    selected.map((item) => item.documentVersionId),
  );
  const selectedDocumentIds = new Set(
    selected.map((item) => item.documentId),
  );
  const outcome = (
    metadata.applicabilityResult as { outcome?: unknown } | null
  )?.outcome;
  const requirementCount =
    resolvedRelease && typeof outcome === "string"
      ? resolvedRelease.requirements.filter((requirement) =>
          requirement.applicabilityOutcomeCodes.includes(outcome),
        ).length
      : 0;

  return {
    draft,
    selected,
    summary: {
      baseAcceptedGapRevisionId: draft.baseAcceptedGapRevisionId,
      baseAcceptedGapRevisionNumber:
        metadata.baseAcceptedGapRevisionNumber ?? null,
      assessmentRevisionId: draft.assessmentRevisionId,
      assessmentRevisionNumber: metadata.assessmentRevisionNumber ?? null,
      gapAnalysisReleaseId: draft.gapAnalysisReleaseId,
      gapAnalysisReleaseVersion: resolvedRelease?.versionLabel ?? null,
      requirementCount,
      carried: selected
        .filter((item) => item.selectionOrigin === "approved_carryover")
        .map((item) => item.documentVersionId),
      replaced: selected
        .filter((item) => item.selectionOrigin === "version_replacement")
        .map((item) => item.documentVersionId),
      added: selected
        .filter((item) => item.selectionOrigin === "explicit_addition")
        .map((item) => item.documentVersionId),
      removed: base
        .filter((item) => !selectedDocumentIds.has(item.documentId))
        .map((item) => item.versionId),
      selectedDocumentVersionIds: [...selectedIds],
    },
  };
}

export async function generateGapReassessment(
  input: {
    userId: string;
    organizationId: string;
    draftId: string;
    expectedLockVersion: number;
    locale: Locale;
    idempotencyKey: string;
  },
) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  return enqueueDraftGeneration({ ...input, operation: "generate" });
}

export async function retryGapReassessment(
  input: {
    userId: string;
    organizationId: string;
    draftId: string;
    locale: Locale;
    retryNonce: string;
    idempotencyKey: string;
  },
) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const failedDraft = await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.id, input.draftId),
      eq(gapReassessmentDrafts.organizationId, input.organizationId),
      inArray(gapReassessmentDrafts.status, [...retryableGapReassessmentStatuses]),
    ),
  });
  if (!failedDraft) {
    throw new ApiError(409, "Only a failed or cancelled reassessment can be retried");
  }
  return enqueueDraftGeneration({ ...input, operation: "retry", failedDraft });
}

async function enqueueDraftGeneration(input: {
  userId: string;
  organizationId: string;
  draftId: string;
  expectedLockVersion?: number;
  locale: Locale;
  idempotencyKey: string;
  operation: "generate" | "retry";
  retryNonce?: string;
  failedDraft?: typeof gapReassessmentDrafts.$inferSelect;
}) {
  const candidate = input.failedDraft ?? await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.id, input.draftId),
      eq(gapReassessmentDrafts.organizationId, input.organizationId),
    ),
  });
  if (!candidate) throw new ApiError(404, "Reassessment draft not found");
  const candidateAssessment = await db.query.assessments.findFirst({
    where: and(
      eq(assessments.id, candidate.assessmentId),
      eq(assessments.organizationId, input.organizationId),
    ),
  });
  if (!candidateAssessment) throw new ApiError(404, "Gap assessment not found");
  await assertGapInputsMutable({
    organizationId: input.organizationId,
    moduleId: candidateAssessment.moduleId,
  });
  const requestFingerprint = fingerprintRequest({
    draftId: input.draftId,
    expectedLockVersion: input.expectedLockVersion,
    retryNonce: input.retryNonce,
  });
  return db.transaction(async (tx) => {
    const claimValues = {
      actorKey: input.userId,
      organizationId: input.organizationId,
      scope: `organization:${input.organizationId}:gap-reassessment`,
      operation: input.operation,
      key: input.idempotencyKey,
      requestFingerprint,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    const [claimed] = await tx.insert(idempotencyRecords).values(claimValues).onConflictDoNothing().returning();
    if (!claimed) {
      const existing = await tx.query.idempotencyRecords.findFirst({
        where: and(
          eq(idempotencyRecords.actorKey, claimValues.actorKey),
          eq(idempotencyRecords.scope, claimValues.scope),
          eq(idempotencyRecords.operation, claimValues.operation),
          eq(idempotencyRecords.key, claimValues.key),
        ),
      });
      if (!existing || existing.requestFingerprint !== requestFingerprint) {
        throw new ApiError(409, "Idempotency key was reused with different input", undefined, "IDEMPOTENCY_KEY_REUSED");
      }
      if (existing.state !== "succeeded" || existing.resultType !== "background_job" || !existing.resultId) {
        throw new ApiError(409, "Generation enqueue is still in progress", undefined, "IDEMPOTENCY_IN_PROGRESS");
      }
      const replayJob = await tx.query.backgroundJobs.findFirst({ where: eq(backgroundJobs.id, existing.resultId) });
      const replayDraft = await tx.query.gapReassessmentDrafts.findFirst({ where: eq(gapReassessmentDrafts.id, input.draftId) });
      if (!replayJob || !replayDraft) throw new ApiError(409, "Generation replay target is unavailable", undefined, "IDEMPOTENCY_RESULT_MISSING");
      return { draft: replayDraft, job: toJobDto(replayJob), reused: true };
    }
    await lockAssessmentGenerationSlot(tx, candidate);
    const [locked] = await tx
      .update(gapReassessmentDrafts)
      .set({ status: "locked", lockedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(gapReassessmentDrafts.id, input.draftId),
          eq(gapReassessmentDrafts.organizationId, input.organizationId),
          input.operation === "generate"
            ? eq(gapReassessmentDrafts.status, "open")
            : inArray(gapReassessmentDrafts.status, [...retryableGapReassessmentStatuses]),
          ...(input.operation === "generate" && input.expectedLockVersion
            ? [eq(gapReassessmentDrafts.lockVersion, input.expectedLockVersion)]
            : []),
        ),
      )
      .returning();
    if (!locked) throw new ApiError(409, "Reassessment draft changed before generation");
    const [job] = await tx.insert(backgroundJobs).values({
      organizationId: input.organizationId,
      requestedByUserId: input.userId,
      kind: "gap-generation",
      payload: { draftId: locked.id, locale: input.locale, retryNonce: input.retryNonce },
      cancellable: true,
      cancellationCapability: "gap:contribute",
      maxAttempts: 1,
    }).returning();
    const [linkedDraft] = await tx.update(gapReassessmentDrafts).set({
      generationJobId: job.id,
      aiProcessingRunId: null,
      outputGapRevisionId: null,
      completedAt: null,
      updatedAt: new Date(),
    }).where(eq(gapReassessmentDrafts.id, locked.id)).returning();
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: input.operation === "retry" ? "gap_reassessment.retry_enqueued" : "gap_reassessment.generation_enqueued",
      entityType: "gap_reassessment_draft",
      entityId: input.draftId,
      metadata: { lockVersion: input.expectedLockVersion, retryNonce: input.retryNonce, jobId: job.id },
    });
    await tx.update(idempotencyRecords).set({
      state: "succeeded", responseStatus: 202, resultType: "background_job", resultId: job.id, updatedAt: new Date(),
    }).where(eq(idempotencyRecords.id, claimed.id));
    return { draft: linkedDraft, job: toJobDto(job), reused: false };
  });
}

async function lockAssessmentGenerationSlot(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  draft: typeof gapReassessmentDrafts.$inferSelect,
) {
  const [assessment] = await tx
    .update(assessments)
    .set({ status: "active" })
    .where(
      and(
        eq(assessments.id, draft.assessmentId),
        eq(assessments.organizationId, draft.organizationId),
        eq(assessments.status, "active"),
      ),
    )
    .returning();
  if (!assessment) throw new ApiError(409, "Gap assessment is no longer active");
  const competingDraft = await tx.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.assessmentId, draft.assessmentId),
      eq(gapReassessmentDrafts.status, "locked"),
      ne(gapReassessmentDrafts.id, draft.id),
    ),
  });
  if (competingDraft) {
    throw new ApiError(409, "Another reassessment generation is still running");
  }
  const artifact = await tx.query.generatedArtifacts.findFirst({
    where: and(
      eq(generatedArtifacts.organizationId, draft.organizationId),
      eq(generatedArtifacts.moduleId, assessment.moduleId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ),
  });
  if (artifact?.currentRevisionId) {
    throw new ApiError(
      409,
      "A Gap Analysis has already been generated",
      undefined,
      "GAP_ALREADY_GENERATED",
    );
  }
}

async function lockEligibleEvidenceSelection(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  selection: Array<{ versionId: string; documentId: string }>,
) {
  if (!selection.length) return;
  const documentIds = [...new Set(selection.map((item) => item.documentId))];
  const lockedDocuments = await tx
    .update(documents)
    .set({ updatedAt: sql`${documents.updatedAt}` })
    .where(
      and(
        eq(documents.organizationId, organizationId),
        eq(documents.status, "active"),
        inArray(documents.id, documentIds),
      ),
    )
    .returning({ id: documents.id, currentVersionId: documents.currentVersionId });
  if (
    lockedDocuments.length !== documentIds.length ||
    selection.some(
      (item) =>
        lockedDocuments.find((document) => document.id === item.documentId)
          ?.currentVersionId !== item.versionId,
    )
  ) {
    throw new ApiError(409, "A selected document version is no longer current");
  }
  const indexed = await tx
    .select({ versionId: documentVersions.id })
    .from(documentVersions)
    .innerJoin(
      documentExtractions,
      eq(documentExtractions.documentVersionId, documentVersions.id),
    )
    .innerJoin(
      documentEmbeddingGenerations,
      eq(documentEmbeddingGenerations.extractionId, documentExtractions.id),
    )
    .where(
      and(
        inArray(
          documentVersions.id,
          selection.map((item) => item.versionId),
        ),
        eq(documentEmbeddingGenerations.status, "succeeded"),
      ),
    );
  if (
    new Set(indexed.map((item) => item.versionId)).size !== selection.length
  ) {
    throw new ApiError(409, "A selected document version is no longer indexed");
  }
}

async function runLockedDraft(
  draft: typeof gapReassessmentDrafts.$inferSelect,
  input: { userId: string; organizationId: string; locale: Locale },
  retryNonce?: string,
  jobId?: string,
  deferFailure = false,
) {
  const selected = await db.query.gapReassessmentDraftDocuments.findMany({
    where: eq(gapReassessmentDraftDocuments.draftId, draft.id),
  });
  try {
    const result = await generateGapAnalysis(
      {
        userId: input.userId,
        organizationId: input.organizationId,
        assessmentId: draft.assessmentId,
        assessmentRevisionId: draft.assessmentRevisionId,
        selectedDocumentVersionIds: selected.map((item) => item.documentVersionId),
        locale: input.locale,
        retryNonce,
        jobId,
        asOfDate: draft.lockedAt?.toISOString().slice(0, 10),
      },
    );
    if (!result.artifactRevision) {
      throw new ApiError(
        409,
        "Generation did not produce a new analysis result",
        undefined,
        "GAP_GENERATION_RESULT_MISSING",
      );
    }
    if (!jobId) await db.transaction(async (tx) => {
      await tx
        .update(gapReassessmentDrafts)
        .set({
          status: "generated",
          aiProcessingRunId: result.run.id,
          outputGapRevisionId: result.artifactRevision!.id,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(gapReassessmentDrafts.id, draft.id), eq(gapReassessmentDrafts.status, "locked")));
      await tx.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "gap_reassessment.generated",
        entityType: "gap_reassessment_draft",
        entityId: draft.id,
        metadata: {
          aiProcessingRunId: result.run.id,
          outputGapRevisionId: result.artifactRevision!.id,
        },
      });
    });
    return result;
  } catch (error) {
    if (deferFailure) throw error;
    const run = await db.query.aiProcessingRuns.findFirst({
      where: and(
        eq(aiProcessingRuns.organizationId, input.organizationId),
        eq(aiProcessingRuns.assessmentRevisionId, draft.assessmentRevisionId),
        eq(aiProcessingRuns.operationKind, "gap_analysis"),
      ),
      orderBy: [desc(aiProcessingRuns.createdAt)],
    });
    await db.transaction(async (tx) => {
      await tx
        .update(gapReassessmentDrafts)
        .set({
          status: "failed",
          aiProcessingRunId: run?.id,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(gapReassessmentDrafts.id, draft.id));
      await tx.insert(auditEvents).values({
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "gap_reassessment.failed",
        entityType: "gap_reassessment_draft",
        entityId: draft.id,
        metadata: { aiProcessingRunId: run?.id ?? null },
      });
    });
    throw error;
  }
}

export async function executeGapGenerationJob(input: {
  jobId: string;
  draftId: string;
  userId: string;
  organizationId: string;
  locale: Locale;
  retryNonce?: string;
}) {
  const draft = await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.id, input.draftId),
      eq(gapReassessmentDrafts.organizationId, input.organizationId),
      eq(gapReassessmentDrafts.generationJobId, input.jobId),
    ),
  });
  if (!draft) throw new ApiError(404, "Gap generation draft not found", undefined, "GAP_DRAFT_NOT_FOUND");
  if (draft.status === "generated" && draft.outputGapRevisionId) {
    return { type: "generated_artifact_revision", id: draft.outputGapRevisionId };
  }
  if (draft.status !== "locked") throw new ApiError(409, "Gap generation draft is not locked", undefined, "GAP_DRAFT_NOT_LOCKED");
  const result = await runLockedDraft(draft, input, input.retryNonce, input.jobId, true);
  return { type: "generated_artifact_revision", id: result.artifactRevision!.id };
}

async function loadPreparationContext(organizationId: string, assessmentId: string) {
  const assessment = await db.query.assessments.findFirst({
    where: and(
      eq(assessments.id, assessmentId),
      eq(assessments.organizationId, organizationId),
      eq(assessments.status, "active"),
    ),
  });
  if (!assessment?.gapAnalysisReleaseId || !assessment.currentRevisionId) {
    throw new ApiError(409, "Save the gap questionnaire before reassessment");
  }
  const artifact = await db.query.generatedArtifacts.findFirst({
    where: and(
      eq(generatedArtifacts.organizationId, organizationId),
      eq(generatedArtifacts.moduleId, assessment.moduleId),
      eq(generatedArtifacts.artifactType, "gap_analysis_result"),
    ),
  });
  return { assessment, artifact };
}

async function loadAcceptedEvidence(acceptedRevisionId: string | null | undefined) {
  if (!acceptedRevisionId) return [];
  const sources = await db.query.artifactRevisionSources.findMany({
    where: and(
      eq(artifactRevisionSources.artifactRevisionId, acceptedRevisionId),
      eq(artifactRevisionSources.sourceType, "document_version"),
    ),
  });
  if (!sources.length) return [];
  const versions = await db.query.documentVersions.findMany({
    where: inArray(
      documentVersions.id,
      sources.map((source) => source.sourceId),
    ),
  });
  return versions.map((version) => ({
    versionId: version.id,
    documentId: version.documentId,
  }));
}

async function resolveEvidenceSelection(input: {
  organizationId: string;
  accepted: Array<{ versionId: string; documentId: string }>;
  explicitAdditions: string[];
}) {
  const documentIds = new Set(input.accepted.map((item) => item.documentId));
  const explicitVersions = input.explicitAdditions.length
    ? await db.query.documentVersions.findMany({
        where: inArray(documentVersions.id, [...new Set(input.explicitAdditions)]),
      })
    : [];
  explicitVersions.forEach((version) => documentIds.add(version.documentId));
  const documentRows = documentIds.size
    ? await db.query.documents.findMany({
        where: and(
          eq(documents.organizationId, input.organizationId),
          inArray(documents.id, [...documentIds]),
        ),
      })
    : [];
  const candidateIds = new Set([
    ...input.accepted.map((item) => item.versionId),
    ...input.explicitAdditions,
    ...documentRows.flatMap((document) =>
      document.currentVersionId ? [document.currentVersionId] : [],
    ),
  ]);
  const rows = candidateIds.size
    ? await db
        .select({
          version: documentVersions,
          document: documents,
          extraction: documentExtractions,
          embedding: documentEmbeddingGenerations,
        })
        .from(documentVersions)
        .innerJoin(documents, eq(documentVersions.documentId, documents.id))
        .leftJoin(
          documentExtractions,
          eq(documentExtractions.documentVersionId, documentVersions.id),
        )
        .leftJoin(
          documentEmbeddingGenerations,
          eq(documentEmbeddingGenerations.extractionId, documentExtractions.id),
        )
        .where(
          and(
            eq(documents.organizationId, input.organizationId),
            inArray(documentVersions.id, [...candidateIds]),
          ),
        )
    : [];
  const candidates = [...new Map(rows.map((row) => [row.version.id, row])).values()].map(
    (row) => ({
      versionId: row.version.id,
      documentId: row.version.documentId,
      currentVersionId: row.document.currentVersionId,
      active: row.document.status === "active" && !row.version.archivedAt,
      indexed: rows.some(
        (candidate) =>
          candidate.version.id === row.version.id &&
          candidate.embedding?.status === "succeeded",
      ),
    }),
  );
  if (explicitVersions.length !== new Set(input.explicitAdditions).size) {
    return { selection: [], removed: [], blocked: input.explicitAdditions };
  }
  return buildReassessmentEvidenceSelection({
    accepted: input.accepted,
    candidates,
    explicitAdditions: input.explicitAdditions,
  });
}
