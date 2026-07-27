import { db } from "@/src/db";
import { actionPlans, assessmentAnswerOptions, assessmentAnswers, assessments, documentChunks, documentExtractions, documentVersions, documents, gapFindingEvidence, gapFindings, gapItems, gapReassessmentDrafts, gapRequirementVersions, gapAnalysisReleases, generatedArtifactRevisions, generatedArtifacts, legalSourceChunks, legalSourceProcessingGenerations, legalSourceRenditions, legalSources, legalSourceVersions, questionOptions } from "@/src/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  getOrganizationDocumentLibraryPreauthorized,
} from "@/src/server/documents";
import {
  getGapReassessmentDraftPreauthorized,
} from "./reassessment-service";
import {
  getGapRevisionStalenessBatchPreauthorized,
} from "./staleness";
import type { LoadedGapRelease } from "./release-loader";
import { getSupportedCountryCodes } from "../applicability-check/domain";
import {
  nextCachedRuntimeReleaseReader,
  type RuntimeReleaseReader,
} from "../compliance";
import {
  evaluateGapApplicabilityPrerequisite,
  projectGapPrerequisiteView,
} from "./applicability-eligibility";

export async function loadGapPrerequisiteState(
  input: PageInput,
  release: LoadedGapRelease,
  runtimeReleaseReader: RuntimeReleaseReader =
    nextCachedRuntimeReleaseReader,
) {
  const [row] = await db
    .select({
      id: generatedArtifactRevisions.id,
      checkReleaseId: generatedArtifactRevisions.checkReleaseId,
      status: generatedArtifactRevisions.status,
      result: generatedArtifactRevisions.result,
    })
    .from(generatedArtifacts)
    .innerJoin(
      generatedArtifactRevisions,
      eq(generatedArtifacts.currentRevisionId, generatedArtifactRevisions.id),
    )
    .where(
      and(
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.artifactType, "affectedness_result"),
      ),
    )
    .limit(1);
  const applicabilityRelease =
    await runtimeReleaseReader.getPublished({
      checkReleaseId: release.compatibleCheckReleaseId,
      locale: input.locale,
    });
  const prerequisite = evaluateGapApplicabilityPrerequisite(
    release.compatibleCheckReleaseId,
    row,
  );
  const applicabilityBase = `/tool/organizations/${input.organizationId}/applicability-check`;
  const destination =
    prerequisite.status === "missing"
      ? `${applicabilityBase}/new`
      : prerequisite.status === "not_eligible"
        ? `${applicabilityBase}/result`
        : applicabilityBase;
  return projectGapPrerequisiteView({
    prerequisite,
    supportedCountryCodes: applicabilityRelease
      ? getSupportedCountryCodes(applicabilityRelease.ruleSet.rules)
      : [],
    destination,
  });
}

type PageInput = {
  organizationId: string;
  locale: "de" | "en";
};

export async function loadDocumentsAssessment(
  input: PageInput,
  release: LoadedGapRelease,
) {
  return (
    (await db.query.assessments.findFirst({ columns: { id: true, organizationId: true, moduleId: true, questionnaireId: true, checkReleaseId: true, gapAnalysisReleaseId: true, applicabilityArtifactRevisionId: true, currentRevisionId: true, status: true, createdBy: true, createdAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.organizationId, input.organizationId),
        eq(table.moduleId, release.moduleId),
        eq(table.gapAnalysisReleaseId, release.id),
        eq(table.status, "active"),
      )) ?? operators.sql`true` },
    })) ?? null
  );
}

export type GapWorkflowRunContext = {
  aiProcessingRunId: string | null;
  generationJobId: string | null;
  assessmentRevisionId: string | null;
};

export async function loadWorkflowSnapshot(
  input: PageInput,
  release: LoadedGapRelease,
) {
  const acceptedRevision = alias(
    generatedArtifactRevisions,
    "accepted_gap_revision",
  );
  const currentRevision = alias(
    generatedArtifactRevisions,
    "current_gap_revision",
  );
  const [row] = await db
    .select({
      assessment: assessments,
      acceptedRevision,
      currentRevision,
      activePlan: actionPlans,
      draftAiProcessingRunId: gapReassessmentDrafts.aiProcessingRunId,
      draftGenerationJobId: gapReassessmentDrafts.generationJobId,
    })
    .from(gapAnalysisReleases)
    .leftJoin(
      assessments,
      and(
        eq(assessments.organizationId, input.organizationId),
        eq(assessments.moduleId, gapAnalysisReleases.moduleId),
        eq(assessments.gapAnalysisReleaseId, gapAnalysisReleases.id),
        eq(assessments.status, "active"),
      ),
    )
    .leftJoin(
      generatedArtifacts,
      and(
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.moduleId, gapAnalysisReleases.moduleId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
      ),
    )
    .leftJoin(
      acceptedRevision,
      and(
        eq(acceptedRevision.id, generatedArtifacts.acceptedRevisionId),
        eq(acceptedRevision.status, "approved"),
      ),
    )
    .leftJoin(
      currentRevision,
      eq(currentRevision.id, generatedArtifacts.currentRevisionId),
    )
    .leftJoin(
      actionPlans,
      and(
        eq(actionPlans.organizationId, input.organizationId),
        eq(actionPlans.status, "active"),
      ),
    )
    .leftJoin(
      gapReassessmentDrafts,
      and(
        eq(gapReassessmentDrafts.organizationId, input.organizationId),
        eq(gapReassessmentDrafts.assessmentId, assessments.id),
      ),
    )
    .where(eq(gapAnalysisReleases.id, release.id))
    .orderBy(desc(gapReassessmentDrafts.createdAt))
    .limit(1);

  return {
    assessment: row?.assessment ?? null,
    acceptedRevision: row?.acceptedRevision ?? null,
    currentRevision: row?.currentRevision ?? null,
    activePlan: row?.activePlan ?? null,
    runContext: {
      aiProcessingRunId: row?.draftAiProcessingRunId ?? null,
      generationJobId: row?.draftGenerationJobId ?? null,
      assessmentRevisionId: row?.assessment?.currentRevisionId ?? null,
    },
  };
}

export async function loadAnswers(
  assessment: typeof assessments.$inferSelect | null,
) {
  if (!assessment?.currentRevisionId) return {};
  const rows = await db
    .select({
      answerId: assessmentAnswers.id,
      questionId: assessmentAnswers.questionId,
      optionId: questionOptions.id,
    })
    .from(assessmentAnswers)
    .leftJoin(
      assessmentAnswerOptions,
      eq(
        assessmentAnswerOptions.assessmentAnswerId,
        assessmentAnswers.id,
      ),
    )
    .leftJoin(
      questionOptions,
      eq(assessmentAnswerOptions.questionOptionId, questionOptions.id),
    )
    .where(
      eq(
        assessmentAnswers.assessmentRevisionId,
        assessment.currentRevisionId,
      ),
    );
  const answers: Record<string, string> = {};
  for (const row of rows) {
    if (!(row.questionId in answers)) {
      answers[row.questionId] = row.optionId ?? "";
    }
  }
  return answers;
}

export async function loadFindingsBatch(input: {
  acceptedRevisionId: string | null;
  candidateRevisionId: string | null;
}) {
  const revisionIds = [
    ...new Set(
      [input.acceptedRevisionId, input.candidateRevisionId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
  if (!revisionIds.length) return { accepted: [], candidate: [] };
  const findings = await loadFindingsForRevisionIds(revisionIds);
  const byRevision = (revisionId: string | null) =>
    revisionId
      ? findings.filter(
          (row) => row.finding.artifactRevisionId === revisionId,
        )
      : [];
  return {
    accepted: byRevision(input.acceptedRevisionId),
    candidate: byRevision(input.candidateRevisionId),
  };
}

export async function loadFindingsForRevisionIds(revisionIds: string[]) {
  if (!revisionIds.length) return [];
  const rows = await db
    .select({
      finding: gapFindings,
      requirement: gapRequirementVersions,
      evidence: gapFindingEvidence,
      documentSource: {
        versionId: documentVersions.id,
        title: documents.title,
        mimeType: documentVersions.mimeType,
        chunkPageNumber: documentChunks.pageNumber,
        chunkSectionLabel: documentChunks.sectionLabel,
      },
      legalSource: {
        versionId: legalSourceVersions.id,
        title: legalSources.title,
        upstreamUrl: legalSourceVersions.upstreamUrl,
        mimeType: legalSourceRenditions.mimeType,
        chunkPageNumber: legalSourceChunks.pageNumber,
        chunkSectionLabel: legalSourceChunks.sectionPath,
      },
    })
    .from(gapFindings)
    .innerJoin(
      gapRequirementVersions,
      eq(gapFindings.requirementVersionId, gapRequirementVersions.id),
    )
    .leftJoin(
      gapFindingEvidence,
      eq(gapFindingEvidence.findingId, gapFindings.id),
    )
    .leftJoin(
      documentChunks,
      eq(gapFindingEvidence.documentChunkId, documentChunks.id),
    )
    .leftJoin(
      documentExtractions,
      eq(documentChunks.extractionId, documentExtractions.id),
    )
    .leftJoin(
      documentVersions,
      eq(documentExtractions.documentVersionId, documentVersions.id),
    )
    .leftJoin(documents, eq(documentVersions.documentId, documents.id))
    .leftJoin(
      legalSourceChunks,
      eq(gapFindingEvidence.legalSourceChunkId, legalSourceChunks.id),
    )
    .leftJoin(
      legalSourceProcessingGenerations,
      eq(
        legalSourceChunks.generationId,
        legalSourceProcessingGenerations.id,
      ),
    )
    .leftJoin(
      legalSourceRenditions,
      eq(
        legalSourceProcessingGenerations.renditionId,
        legalSourceRenditions.id,
      ),
    )
    .leftJoin(
      legalSourceVersions,
      eq(legalSourceRenditions.sourceVersionId, legalSourceVersions.id),
    )
    .leftJoin(legalSources, eq(legalSourceVersions.sourceId, legalSources.id))
    .where(inArray(gapFindings.artifactRevisionId, revisionIds))
    .orderBy(
      gapFindings.id,
      gapFindingEvidence.createdAt,
      gapFindingEvidence.id,
    );

  const findings = new Map<
    string,
    {
      finding: typeof gapFindings.$inferSelect;
      requirement: typeof gapRequirementVersions.$inferSelect;
      evidence: Array<
        typeof gapFindingEvidence.$inferSelect & {
          documentSource: (typeof rows)[number]["documentSource"];
          legalSource: (typeof rows)[number]["legalSource"];
        }
      >;
      gaps: Array<typeof gapItems.$inferSelect>;
    }
  >();
  for (const row of rows) {
    const current = findings.get(row.finding.id) ?? {
      finding: row.finding,
      requirement: row.requirement,
      evidence: [],
      gaps: [],
    };
    if (
      row.evidence &&
      !current.evidence.some((evidence) => evidence.id === row.evidence!.id)
    ) {
      current.evidence.push({
        ...row.evidence,
        documentSource: row.documentSource,
        legalSource: row.legalSource,
      });
    }
    findings.set(row.finding.id, current);
  }
  const atomicGaps = findings.size
    ? await db.query.gapItems.findMany({
        columns: {
          id: true,
          findingId: true,
          sourceAssessmentAnswerId: true,
          questionStableKey: true,
          kind: true,
          statement: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
        where: {
          RAW: (table, operators) =>
            inArray(table.findingId, [...findings.keys()]) ??
            operators.sql`true`,
        },
        orderBy: { position: "asc" },
      })
    : [];
  for (const gap of atomicGaps) {
    findings.get(gap.findingId)?.gaps.push(gap);
  }
  return [...findings.values()];
}

export async function loadReassessment(
  input: PageInput,
  assessment: typeof assessments.$inferSelect | null,
  release: LoadedGapRelease,
) {
  return assessment
    ? getGapReassessmentDraftPreauthorized({
        organizationId: input.organizationId,
        assessmentId: assessment.id,
        locale: input.locale,
        release,
      })
    : null;
}

export async function loadRun(
  input: PageInput,
  context: GapWorkflowRunContext,
) {
  if (context.aiProcessingRunId) {
    return (
      (await db.query.aiProcessingRuns.findFirst({ columns: { id: true, organizationId: true, assessmentRevisionId: true, operationKind: true, status: true, outputLocale: true, attemptCount: true, languageValidation: true, inputHash: true, idempotencyKey: true, provider: true, model: true, promptName: true, promptVersion: true, promptTemplateHash: true, renderedInputHash: true, responseSchemaVersion: true, inputTokens: true, outputTokens: true, cachedInputTokens: true, validatedOutput: true, jobId: true, providerPolicyVersion: true, corpusReleaseSetHash: true, provenanceStatus: true, cancellationRequestedAt: true, outputArtifactRevisionId: true, errorCode: true, errorMessage: true, createdBy: true, createdAt: true, startedAt: true, completedAt: true },
        where: { RAW: (table, operators) => (eq(table.id, context.aiProcessingRunId!)) ?? operators.sql`true` },
      })) ?? null
    );
  }
  if (context.generationJobId) {
    return (
      (await db.query.aiProcessingRuns.findFirst({ columns: { id: true, organizationId: true, assessmentRevisionId: true, operationKind: true, status: true, outputLocale: true, attemptCount: true, languageValidation: true, inputHash: true, idempotencyKey: true, provider: true, model: true, promptName: true, promptVersion: true, promptTemplateHash: true, renderedInputHash: true, responseSchemaVersion: true, inputTokens: true, outputTokens: true, cachedInputTokens: true, validatedOutput: true, jobId: true, providerPolicyVersion: true, corpusReleaseSetHash: true, provenanceStatus: true, cancellationRequestedAt: true, outputArtifactRevisionId: true, errorCode: true, errorMessage: true, createdBy: true, createdAt: true, startedAt: true, completedAt: true },
        where: { RAW: (table, operators) => (eq(table.jobId, context.generationJobId!)) ?? operators.sql`true` },
        orderBy: { createdAt: "desc" },
      })) ?? null
    );
  }
  if (!context.assessmentRevisionId) return null;
  return (
    (await db.query.aiProcessingRuns.findFirst({ columns: { id: true, organizationId: true, assessmentRevisionId: true, operationKind: true, status: true, outputLocale: true, attemptCount: true, languageValidation: true, inputHash: true, idempotencyKey: true, provider: true, model: true, promptName: true, promptVersion: true, promptTemplateHash: true, renderedInputHash: true, responseSchemaVersion: true, inputTokens: true, outputTokens: true, cachedInputTokens: true, validatedOutput: true, jobId: true, providerPolicyVersion: true, corpusReleaseSetHash: true, provenanceStatus: true, cancellationRequestedAt: true, outputArtifactRevisionId: true, errorCode: true, errorMessage: true, createdBy: true, createdAt: true, startedAt: true, completedAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.organizationId, input.organizationId),
        eq(
          table.assessmentRevisionId,
          context.assessmentRevisionId!,
        ),
        eq(table.operationKind, "gap_analysis"),
      )) ?? operators.sql`true` },
      orderBy: { createdAt: "desc" },
    })) ?? null
  );
}

export const postgresGapPageData = {
  getOrganizationDocumentLibraryPreauthorized,
  loadDocumentsAssessment,
  loadWorkflowSnapshot,
  loadAnswers,
  loadFindingsBatch,
  loadReassessment,
  loadStalenessBatch: getGapRevisionStalenessBatchPreauthorized,
  loadRun,
  loadGapPrerequisiteState,
};
