import { db } from "@/src/db";
import {
  aiProcessingRuns,
  artifactRevisionSources,
  assessmentRevisions,
  assessments,
  auditEvents,
  documentEmbeddingGenerations,
  documentExtractions,
  documentVersions,
  documents,
  gapReassessmentDraftDocuments,
  gapReassessmentDrafts,
  generatedArtifactRevisions,
  generatedArtifacts,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  assertCanAccessOrganization,
  assertCanContributeToOrganization,
} from "../organizations/service";
import { generateGapAnalysis } from "./generation-service";
import type { DocumentEmbeddingProvider } from "../documents/embeddings";
import type { GapGenerationModel } from "./model";
import { loadGapAnalysisRelease } from "./release-loader";
import { buildReassessmentEvidenceSelection } from "./reassessment-selection";

type GenerationDependencies = {
  model?: GapGenerationModel;
  embeddingProvider?: DocumentEmbeddingProvider;
};

export async function prepareGapReassessment(input: {
  userId: string;
  organizationId: string;
  assessmentId: string;
  selectedDocumentVersionIds: string[];
  locale: Locale;
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const context = await loadPreparationContext(input.organizationId, input.assessmentId);
  const existing = await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.assessmentId, context.assessment.id),
      eq(gapReassessmentDrafts.status, "open"),
    ),
  });
  if (existing) {
    const current = await db.query.gapReassessmentDraftDocuments.findMany({
      where: eq(gapReassessmentDraftDocuments.draftId, existing.id),
    });
    if (input.selectedDocumentVersionIds.length) {
      await updateGapReassessmentEvidence({
        userId: input.userId,
        organizationId: input.organizationId,
        draftId: existing.id,
        expectedLockVersion: existing.lockVersion,
        selectedDocumentVersionIds: [
          ...new Set([
            ...current.map((row) => row.documentVersionId),
            ...input.selectedDocumentVersionIds,
          ]),
        ],
      });
    }
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
    if (!concurrent) throw new ApiError(409, "Reassessment draft changed concurrently");
    return getGapReassessmentDraft({
      userId: input.userId,
      organizationId: input.organizationId,
      draftId: concurrent.id,
      locale: input.locale,
    });
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
    throw new ApiError(409, "Only an open reassessment draft can be edited");
  }
  const baseDocuments = await loadAcceptedEvidence(draft.baseAcceptedGapRevisionId);
  const selection = await resolveEvidenceSelection({
    organizationId: input.organizationId,
    accepted: baseDocuments,
    explicitAdditions: input.selectedDocumentVersionIds,
    exactSelection: true,
  });
  if (selection.blocked.length) {
    throw new ApiError(409, "Selected evidence must be an indexed current version");
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
      throw new ApiError(409, "Reassessment evidence changed in another session");
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

export async function getGapReassessmentDraft(input: {
  userId: string;
  organizationId: string;
  draftId?: string;
  assessmentId?: string;
  locale: Locale;
}) {
  await assertCanAccessOrganization(input.userId, input.organizationId);
  const draft = await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.organizationId, input.organizationId),
      ...(input.draftId ? [eq(gapReassessmentDrafts.id, input.draftId)] : []),
      ...(input.assessmentId
        ? [eq(gapReassessmentDrafts.assessmentId, input.assessmentId)]
        : []),
    ),
    orderBy: [desc(gapReassessmentDrafts.createdAt)],
  });
  if (!draft) return null;
  const selected = await db.query.gapReassessmentDraftDocuments.findMany({
    where: eq(gapReassessmentDraftDocuments.draftId, draft.id),
  });
  const base = await loadAcceptedEvidence(draft.baseAcceptedGapRevisionId);
  const selectedIds = new Set(selected.map((item) => item.documentVersionId));
  const selectedDocumentIds = new Set(selected.map((item) => item.documentId));
  const release = await loadGapAnalysisRelease(draft.gapAnalysisReleaseId, input.locale);
  const [baseRevision, assessmentRevision] = await Promise.all([
    draft.baseAcceptedGapRevisionId
      ? db.query.generatedArtifactRevisions.findFirst({
          where: eq(
            generatedArtifactRevisions.id,
            draft.baseAcceptedGapRevisionId,
          ),
        })
      : null,
    db.query.assessmentRevisions.findFirst({
      where: eq(assessmentRevisions.id, draft.assessmentRevisionId),
    }),
  ]);
  const assessment = await db.query.assessments.findFirst({
    where: eq(assessments.id, draft.assessmentId),
  });
  let requirementCount = 0;
  if (release && assessment?.applicabilityArtifactRevisionId) {
    const applicability = await db.query.generatedArtifactRevisions.findFirst({
      where: eq(
        generatedArtifactRevisions.id,
        assessment.applicabilityArtifactRevisionId,
      ),
    });
    const outcome = (applicability?.result as { outcome?: unknown })?.outcome;
    if (typeof outcome === "string") {
      requirementCount = release.requirements.filter((requirement) =>
        requirement.applicabilityOutcomeCodes.includes(outcome),
      ).length;
    }
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
      gapAnalysisReleaseVersion: release?.versionLabel ?? null,
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
  },
  dependencies: GenerationDependencies = {},
) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const draft = await lockDraftForGeneration(input);
  return runLockedDraft(draft, input, dependencies);
}

export async function retryGapReassessment(
  input: {
    userId: string;
    organizationId: string;
    draftId: string;
    locale: Locale;
    retryNonce: string;
  },
  dependencies: GenerationDependencies = {},
) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const failedDraft = await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.id, input.draftId),
      eq(gapReassessmentDrafts.organizationId, input.organizationId),
      eq(gapReassessmentDrafts.status, "failed"),
    ),
  });
  if (!failedDraft) {
    throw new ApiError(409, "Only a failed reassessment can be retried");
  }
  const draft = await db.transaction(async (tx) => {
    await lockAssessmentGenerationSlot(tx, failedDraft);
    const [locked] = await tx
      .update(gapReassessmentDrafts)
      .set({ status: "locked", lockedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(gapReassessmentDrafts.id, input.draftId),
          eq(gapReassessmentDrafts.organizationId, input.organizationId),
          eq(gapReassessmentDrafts.status, "failed"),
        ),
      )
      .returning();
    if (!locked) return null;
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_reassessment.retry_started",
      entityType: "gap_reassessment_draft",
      entityId: input.draftId,
      metadata: { retryNonce: input.retryNonce },
    });
    return locked;
  });
  if (!draft) throw new ApiError(409, "Only a failed reassessment can be retried");
  return runLockedDraft(draft, input, dependencies, input.retryNonce);
}

async function lockDraftForGeneration(input: {
  userId: string;
  organizationId: string;
  draftId: string;
  expectedLockVersion: number;
}) {
  const openDraft = await db.query.gapReassessmentDrafts.findFirst({
    where: and(
      eq(gapReassessmentDrafts.id, input.draftId),
      eq(gapReassessmentDrafts.organizationId, input.organizationId),
    ),
  });
  if (!openDraft) throw new ApiError(404, "Reassessment draft not found");
  const draft = await db.transaction(async (tx) => {
    await lockAssessmentGenerationSlot(tx, openDraft);
    const [locked] = await tx
      .update(gapReassessmentDrafts)
      .set({ status: "locked", lockedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(gapReassessmentDrafts.id, input.draftId),
          eq(gapReassessmentDrafts.organizationId, input.organizationId),
          eq(gapReassessmentDrafts.status, "open"),
          eq(gapReassessmentDrafts.lockVersion, input.expectedLockVersion),
        ),
      )
      .returning();
    if (!locked) return null;
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_reassessment.locked",
      entityType: "gap_reassessment_draft",
      entityId: input.draftId,
      metadata: { lockVersion: input.expectedLockVersion },
    });
    return locked;
  });
  if (!draft) throw new ApiError(409, "Reassessment draft changed before generation");
  return draft;
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
  if (
    artifact?.currentRevisionId &&
    artifact.currentRevisionId !== artifact.acceptedRevisionId
  ) {
    throw new ApiError(409, "Review the current candidate before generating another one");
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
  dependencies: GenerationDependencies,
  retryNonce?: string,
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
      },
      dependencies,
    );
    if (!result.artifactRevision) {
      throw new ApiError(409, "Generation did not produce a candidate revision");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(gapReassessmentDrafts)
        .set({
          status: "generated",
          aiProcessingRunId: result.run.id,
          outputGapRevisionId: result.artifactRevision!.id,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(gapReassessmentDrafts.id, draft.id));
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
  exactSelection?: boolean;
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
  if (input.exactSelection) {
    const candidateByVersion = new Map(
      candidates.map((candidate) => [candidate.versionId, candidate]),
    );
    const blocked = [...new Set(input.explicitAdditions)].filter((versionId) => {
      const candidate = candidateByVersion.get(versionId);
      return (
        !candidate ||
        !candidate.active ||
        !candidate.indexed ||
        candidate.currentVersionId !== versionId
      );
    });
    if (blocked.length) return { selection: [], removed: [], blocked };
    const acceptedByDocument = new Map(
      input.accepted.map((accepted) => [accepted.documentId, accepted]),
    );
    const selection = input.explicitAdditions.flatMap((versionId) => {
      const candidate = candidateByVersion.get(versionId);
      if (!candidate) return [];
      const accepted = acceptedByDocument.get(candidate.documentId);
      return [{
        versionId,
        documentId: candidate.documentId,
        origin:
          accepted?.versionId === versionId
            ? "approved_carryover" as const
            : accepted
              ? "version_replacement" as const
              : "explicit_addition" as const,
      }];
    });
    const selectedIds = new Set(selection.map((item) => item.versionId));
    return {
      selection,
      removed: input.accepted
        .filter((accepted) => !selectedIds.has(accepted.versionId))
        .map((accepted) => accepted.versionId),
      blocked: [],
    };
  }
  return buildReassessmentEvidenceSelection({
    accepted: input.accepted,
    candidates,
    explicitAdditions: input.explicitAdditions,
  });
}
