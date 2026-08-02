import type { Locale } from "@/lib/i18n-config";
import { db } from "@/src/db";
import {
  analysisOutputDocumentSources,
  aiProcessingRunContext,
  assessmentAnswers,
  auditEvents,
  documentVersions,
  documents,
  gapFindings,
  gapFindingContextLinks,
  gapItems,
  userProfiles,
} from "@/src/db/schema";
import {
  currentApplicabilityDefinitionHash,
  currentGapDefinitionHash,
  getCurrentGapDefinition,
  SUPPORTED_JURISDICTION_CODES,
} from "@/src/server/definitions";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { hasOrganizationCapability } from "../auth/capabilities";
import { requireOrganizationCapability } from "../auth/capability-service";
import {
  evaluateGapApplicabilityPrerequisite,
  projectGapPrerequisiteView,
} from "./applicability-eligibility";
import { getGapAnalysisCyclePreauthorized } from "./analysis-cycle-service";
import { deriveGapLifecycleCapabilities, deriveGapLifecycleMode } from "./workflow-state";
import { projectGapFindingSources, type GapFindingSourceEvidence } from "./finding-source-projection";

export type GapPageReadInput = {
  userId: string;
  organizationId: string;
  locale: Locale;
  view?: "results" | "inputs" | "history";
};

export async function getGapAnalysisWorkflow(input: GapPageReadInput) {
  const membership = await requireOrganizationCapability(input.userId, input.organizationId, "gap:read");
  const release = getCurrentGapDefinition(input.locale);
  const [assessment, applicabilityOutput, gapOutput, plan, documentRows] = await Promise.all([
    db.query.assessments.findFirst({
      where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
    }),
    db.query.analysisOutputs.findFirst({
      where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "applicability")) ?? operators.sql`true` },
    }),
    db.query.analysisOutputs.findFirst({
      where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
    }),
    db.query.actionPlans.findFirst({
      where: { RAW: (table, operators) => eq(table.organizationId, input.organizationId) ?? operators.sql`true` },
    }),
    db.select({ document: documents, version: documentVersions })
      .from(documents)
      .leftJoin(documentVersions, eq(documentVersions.id, documents.currentVersionId))
      .where(eq(documents.organizationId, input.organizationId))
      .orderBy(desc(documents.createdAt)),
  ]);
  const applicabilityRevision = applicabilityOutput?.currentRevisionId
    ? await db.query.analysisOutputRevisions.findFirst({
        where: { RAW: (table, operators) => eq(table.id, applicabilityOutput.currentRevisionId!) ?? operators.sql`true` },
      })
    : null;
  const prerequisite = projectGapPrerequisiteView({
    prerequisite: evaluateGapApplicabilityPrerequisite(
      currentApplicabilityDefinitionHash,
      applicabilityRevision,
    ),
    supportedCountryCodes: [...SUPPORTED_JURISDICTION_CODES],
    destination: `/tool/organizations/${input.organizationId}/applicability-check`,
  });
  const revision = gapOutput?.currentRevisionId
    ? await db.query.analysisOutputRevisions.findFirst({
        where: { RAW: (table, operators) => eq(table.id, gapOutput.currentRevisionId!) ?? operators.sql`true` },
      })
    : null;
  const cycle = assessment
    ? await getGapAnalysisCyclePreauthorized({
        organizationId: input.organizationId,
        assessmentId: assessment.id,
        locale: input.locale,
      })
    : null;
  const draftAnswers = cycle?.cycle.draftAnswers ?? {};
  const answers = answerIds(release, draftAnswers);
  const questionnaireDraft = cycle
    ? {
        id: cycle.cycle.id,
        status: cycle.cycle.stage === "questions" ? "open" : "submitted",
        version: 1,
        answers,
      }
    : null;
  const findings = revision ? await loadFindings(input.organizationId, revision.id, input.locale) : [];
  const generationRun = revision?.aiProcessingRunId
    ? await db.query.aiProcessingRuns.findFirst({
        where: { RAW: (table, operators) => eq(table.id, revision.aiProcessingRunId!) ?? operators.sql`true` },
      })
    : null;
  const generationActive = cycle?.cycle.stage === "generating";
  const lifecycleMode = deriveGapLifecycleMode({
    hasGeneratedRevision: Boolean(revision),
    hasActiveActionPlan: Boolean(plan),
    generationActive,
  });
  const history = input.view === "history" ? await loadHistory(input.organizationId) : [];
  const generatedInputs = input.view === "inputs" && revision
    ? await loadInputs(input.organizationId, revision.assessmentRevisionId, revision.id)
    : null;
  return {
    role: membership.role,
    canContribute: hasOrganizationCapability(membership.role, "gap:contribute") && !plan,
    canManage: hasOrganizationCapability(membership.role, "plans:manage"),
    release: {
      id: release.id,
      versionLabel: release.versionLabel,
      questions: release.questions,
      requirements: release.requirements,
    },
    assessment: assessment ? { id: assessment.id, currentRevisionId: assessment.currentRevisionId } : null,
    answers,
    questionnaireDraft,
    documentLibrary: {
      documents: documentRows.map(({ document, version }) => ({
        id: document.id,
        title: document.name,
        mimeType: version?.mimeType ?? "application/octet-stream",
        archivedAt: document.archivedAt?.toISOString() ?? null,
        eligibleForAnalysis: !document.archivedAt && version?.indexingStatus === "succeeded",
      })),
    },
    run: generationRun ? { errorCode: generationRun.failureCode } : null,
    revision: revision ? { id: revision.id, outputLocale: revision.locale, createdAt: revision.createdAt } : null,
    acceptedRevision: revision ? { id: revision.id, outputLocale: revision.locale, createdAt: revision.createdAt } : null,
    candidateRevision: null,
    activePlan: plan ? { sourceGapArtifactRevisionId: plan.sourceGapRevisionId } : null,
    analysisCycle: cycle,
    prerequisite,
    history,
    generatedInputs,
    reviewBlockers: findings.filter((row) => row.finding.materialContradiction && !row.finding.contradictionResolved).map((row) => row.finding.id),
    planUpdateAvailable: Boolean(plan && revision && plan.sourceGapRevisionId !== revision.id),
    acceptedStaleness: null,
    candidateStaleness: null,
    staleness: revision?.definitionHash === release.id ? null : { outdated: true },
    lifecycleMode,
    lifecycle: deriveGapLifecycleCapabilities(lifecycleMode),
    findings,
    acceptedFindings: findings,
    candidateFindings: [],
    comparison: [],
    gapCounts: countStatuses(findings),
    lastWorkflowChange: history[0] ?? null,
  };
}

export async function getGapAnalysisRevisionRecord(
  userId: string,
  organizationId: string,
  revisionId: string,
) {
  await requireOrganizationCapability(userId, organizationId, "gap:read");
  return db.query.analysisOutputRevisions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, revisionId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
}

export async function getGapAnalysisRevision(
  userId: string,
  organizationId: string,
  revisionId: string,
) {
  const revision = await getGapAnalysisRevisionRecord(userId, organizationId, revisionId);
  if (!revision) return null;
  return { revision, findings: await loadFindings(organizationId, revision.id, revision.locale as Locale), staleness: revision.definitionHash === currentGapDefinitionHash ? null : { outdated: true } };
}

async function loadFindings(organizationId: string, revisionId: string, locale: Locale) {
  const rows = await db.select().from(gapFindings)
    .where(and(eq(gapFindings.organizationId, organizationId), eq(gapFindings.outputRevisionId, revisionId)))
    .orderBy(asc(gapFindings.position));
  const items = rows.length ? await db.select().from(gapItems)
    .where(inArray(gapItems.findingId, rows.map((row) => row.id)))
    .orderBy(asc(gapItems.position)) : [];
  const contextRows = rows.length ? await db.select({
    findingId: gapFindingContextLinks.findingId,
    context: aiProcessingRunContext,
  }).from(gapFindingContextLinks)
    .innerJoin(aiProcessingRunContext, eq(aiProcessingRunContext.id, gapFindingContextLinks.contextId))
    .where(inArray(gapFindingContextLinks.findingId, rows.map((row) => row.id))) : [];
  return rows.map((finding) => ({
    finding: {
      ...finding,
      requiresReview: finding.materialContradiction && !finding.contradictionResolved,
      reviewNotice: finding.materialContradiction ? finding.summary : null,
      gaps: items.filter((item) => item.findingId === finding.id),
    },
    requirement: {
      id: finding.requirementKey,
      stableRequirementId: finding.requirementKey,
      title: finding.requirementTitle,
      requirementText: finding.requirementText,
      icon: finding.icon,
      criticality: finding.criticality,
      position: finding.position,
    },
    sources: projectGapFindingSources({
      organizationId,
      locale,
      evidence: [
        ...(items.some((item) => item.findingId === finding.id)
          ? [{
              sourceType: "assessment_answer" as const,
              pageNumber: null,
              sectionLabel: null,
            }]
          : []),
        ...contextRows
          .filter((item) => item.findingId === finding.id)
          .map(({ context }) => contextEvidence(context)),
      ],
    }),
    hasOrganizationDocument: contextRows.some(
      (item) => item.findingId === finding.id && item.context.channel === "organization_evidence",
    ),
    manuallyChanged: Boolean(finding.sourceChoice),
  }));
}

function contextEvidence(
  context: typeof aiProcessingRunContext.$inferSelect,
): GapFindingSourceEvidence {
  const metadata = context.metadata && typeof context.metadata === "object"
    ? context.metadata as Record<string, unknown>
    : {};
  const pageNumber = typeof metadata.pageNumber === "number" ? metadata.pageNumber : null;
  const sectionLabel = typeof metadata.sectionPath === "string" ? metadata.sectionPath : null;
  if (context.channel === "organization_evidence") {
    return {
      sourceType: "document_chunk",
      pageNumber,
      sectionLabel,
      documentSource: {
        versionId: stringMetadata(metadata, "documentVersionId"),
        documentId: stringMetadata(metadata, "documentId"),
        title: stringMetadata(metadata, "title"),
        mimeType: stringMetadata(metadata, "mimeType"),
        chunkPageNumber: pageNumber,
        chunkSectionLabel: sectionLabel,
      },
    };
  }
  return {
    sourceType: "legal_source_chunk",
    pageNumber,
    sectionLabel,
    legalSource: {
      versionId: stringMetadata(metadata, "sourceVersionId"),
      title: stringMetadata(metadata, "title"),
      upstreamUrl: stringMetadata(metadata, "officialSourceUrl"),
      mimeType: "application/pdf",
      chunkPageNumber: pageNumber,
      chunkSectionLabel: sectionLabel,
    },
  };
}

function stringMetadata(metadata: Record<string, unknown>, key: string) {
  return typeof metadata[key] === "string" ? metadata[key] : null;
}

async function loadInputs(organizationId: string, assessmentRevisionId: string, outputRevisionId: string) {
  const [answerRows, sourceRows] = await Promise.all([
    db.select().from(assessmentAnswers).where(eq(assessmentAnswers.assessmentRevisionId, assessmentRevisionId)).orderBy(asc(assessmentAnswers.position)),
    db.select({ document: documents, version: documentVersions })
      .from(analysisOutputDocumentSources)
      .innerJoin(documentVersions, eq(documentVersions.id, analysisOutputDocumentSources.documentVersionId))
      .innerJoin(documents, eq(documents.id, documentVersions.documentId))
      .where(and(eq(analysisOutputDocumentSources.organizationId, organizationId), eq(analysisOutputDocumentSources.outputRevisionId, outputRevisionId))),
  ]);
  return {
    questions: answerRows.map((answer) => ({
      questionId: answer.questionKey,
      question: answer.questionText,
      displayAnswer: answer.selectedOptionLabels.join(", "),
    })),
    documents: sourceRows.map(({ document }) => ({
      documentId: document.id,
      title: document.name,
      archived: Boolean(document.archivedAt),
      unavailable: false,
    })),
  };
}

async function loadHistory(organizationId: string) {
  const rows = await db.select({ event: auditEvents, profile: userProfiles })
    .from(auditEvents)
    .leftJoin(userProfiles, eq(userProfiles.userId, auditEvents.actorUserId))
    .where(and(eq(auditEvents.organizationId, organizationId), eq(auditEvents.entityType, "analysis_output_revision")))
    .orderBy(desc(auditEvents.occurredAt));
  return rows.map(({ event, profile }) => ({
    id: event.entityId,
    label: event.eventType,
    occurredAt: event.occurredAt.toISOString(),
    actor: profile?.displayName ?? profile?.email ?? "System",
    reason: null,
  }));
}

function answerIds(release: ReturnType<typeof getCurrentGapDefinition>, answers: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(answers).flatMap(([key, value]) => {
    if (typeof value !== "string") return [];
    const question = release.questions.find((item) => item.stableKey === key);
    const option = question?.options.find((item) => item.stableValue === value);
    return question && option ? [[question.id, option.id]] : [];
  }));
}

function countStatuses(findings: Array<{ finding: { status: string } }>) {
  return findings.reduce<Record<string, number>>((counts, row) => {
    counts.all = (counts.all ?? 0) + 1;
    counts[row.finding.status] = (counts[row.finding.status] ?? 0) + 1;
    return counts;
  }, { all: 0 });
}
