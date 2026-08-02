import { createHash } from "node:crypto";
import type { Locale } from "@/lib/i18n-config";
import { db } from "@/src/db";
import {
  aiProcessingRuns,
  analysisOutputDocumentSources,
  analysisOutputRevisions,
  analysisOutputs,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  auditEvents,
  backgroundJobs,
  documentVersions,
  documents,
  gapAnalysisCycleDocuments,
  gapAnalysisCycles,
  gapFindings,
  gapItems,
} from "@/src/db/schema";
import {
  currentGapDefinitionHash,
  getCurrentGapDefinition,
} from "@/src/server/definitions";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { requireOrganizationCapability } from "../auth/capability-service";
import { evaluateGapRequirement } from "./deterministic-evaluator";

const BUILD_HASH = process.env.APP_BUILD_SHA ?? currentGapDefinitionHash;

export async function prepareGapAnalysisCycle(input: {
  userId: string;
  organizationId: string;
  assessmentId: string;
  selectedDocumentIds: string[];
  locale: Locale;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:contribute");
  const assessment = await requireGapAssessment(input.organizationId, input.assessmentId);
  let cycle = await findUnfinishedCycle(input.organizationId);
  if (!cycle) {
    const draftAnswers = await prefillAnswers(assessment.currentRevisionId);
    const [created] = await db
      .insert(gapAnalysisCycles)
      .values({
        organizationId: input.organizationId,
        definitionHash: currentGapDefinitionHash,
        buildHash: BUILD_HASH,
        locale: input.locale,
        stage: "questions",
        draftAnswers,
        createdBy: input.userId,
      })
      .returning();
    if (!created) throw new Error("Gap analysis cycle was not created");
    cycle = created;
    await db.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_cycle.created",
      entityType: "gap_analysis_cycle",
      entityId: cycle.id,
      metadata: { definitionHash: currentGapDefinitionHash },
    });
  }
  if (cycle.stage === "questions" || cycle.stage === "evidence") {
    await replaceSelectedDocuments(input.organizationId, cycle.id, input.selectedDocumentIds);
    await db
      .update(gapAnalysisCycles)
      .set({ stage: "evidence", updatedAt: new Date() })
      .where(eq(gapAnalysisCycles.id, cycle.id));
  }
  return getGapAnalysisCycle({
    userId: input.userId,
    organizationId: input.organizationId,
    draftId: cycle.id,
    locale: input.locale,
  });
}

export async function replaceGapAnalysisEvidence(input: {
  userId: string;
  organizationId: string;
  draftId: string;
  selectedDocumentIds: string[];
  expectedLockVersion?: number;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:contribute");
  const cycle = await requireCycle(input.organizationId, input.draftId);
  if (cycle.stage !== "questions" && cycle.stage !== "evidence") {
    throw new ApiError(409, "Selected evidence is locked while generation runs", undefined, "GAP_CYCLE_INPUT_LOCKED");
  }
  await replaceSelectedDocuments(input.organizationId, cycle.id, input.selectedDocumentIds);
  await db
    .update(gapAnalysisCycles)
    .set({ stage: "evidence", updatedAt: new Date() })
    .where(eq(gapAnalysisCycles.id, cycle.id));
  return getGapAnalysisCycle({
    userId: input.userId,
    organizationId: input.organizationId,
    draftId: cycle.id,
    locale: cycle.locale as Locale,
  });
}

export async function getGapAnalysisCycle(input: {
  userId: string;
  organizationId: string;
  draftId?: string;
  assessmentId?: string;
  locale: Locale;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:read");
  return readCycle(input);
}

export async function getGapAnalysisCyclePreauthorized(input: {
  organizationId: string;
  draftId?: string;
  assessmentId?: string;
  locale: Locale;
}) {
  return readCycle(input);
}

export async function enqueueGapAnalysisGeneration(input: {
  userId: string;
  organizationId: string;
  draftId: string;
  expectedLockVersion?: number;
  locale: Locale;
  idempotencyKey: string;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:contribute");
  return enqueueCycle(input, false);
}

export async function retryGapAnalysisGeneration(input: {
  userId: string;
  organizationId: string;
  draftId: string;
  retryNonce: string;
  idempotencyKey: string;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:contribute");
  const cycle = await requireCycle(input.organizationId, input.draftId);
  return enqueueCycle({ ...input, locale: cycle.locale as Locale }, true);
}

export async function finalizeGapCycleQuestionnaire(input: {
  userId: string;
  organizationId: string;
  cycleId: string;
  assessmentId: string;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:contribute");
  const cycle = await requireCycle(input.organizationId, input.cycleId);
  const assessment = await requireGapAssessment(input.organizationId, input.assessmentId);
  const revisionId = cycle.assessmentRevisionId ?? (await finalizeAnswers({
    userId: input.userId,
    organizationId: input.organizationId,
    assessment,
    cycle,
    locale: cycle.locale as Locale,
  }));
  await db.transaction(async (tx) => {
    await tx.update(assessments).set({ currentRevisionId: revisionId, updatedAt: new Date() })
      .where(eq(assessments.id, assessment.id));
    await tx.update(gapAnalysisCycles).set({
      assessmentRevisionId: revisionId,
      stage: "evidence",
      questionsCompletedAt: cycle.questionsCompletedAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(gapAnalysisCycles.id, cycle.id));
  });
  const revision = await db.query.assessmentRevisions.findFirst({
    where: { RAW: (table, operators) => eq(table.id, revisionId) ?? operators.sql`true` },
  });
  if (!revision) throw new Error("Gap assessment revision is unavailable");
  return revision;
}

async function enqueueCycle(
  input: {
    userId: string;
    organizationId: string;
    draftId: string;
    locale: Locale;
    idempotencyKey: string;
  },
  retry: boolean,
) {
  const cycle = await requireCycle(input.organizationId, input.draftId);
  if (cycle.stage === "generated" && cycle.outputRevisionId) {
    const job = cycle.generationJobId
      ? await db.query.backgroundJobs.findFirst({ where: { RAW: (table, operators) => eq(table.id, cycle.generationJobId!) ?? operators.sql`true` } })
      : null;
    if (!job) throw new ApiError(409, "The completed cycle has no generation job");
    return { job: toJobDto(job), reused: true };
  }
  if (cycle.stage === "generating") {
    const currentJob = cycle.generationJobId
      ? await db.query.backgroundJobs.findFirst({ where: { RAW: (table, operators) => eq(table.id, cycle.generationJobId!) ?? operators.sql`true` } })
      : null;
    if (currentJob && !["failed", "cancelled"].includes(currentJob.state)) {
      return { job: toJobDto(currentJob), reused: true };
    }
    if (!retry) throw new ApiError(409, "The generation attempt must be retried", undefined, "GAP_GENERATION_RETRY_REQUIRED");
  }
  if (!retry && cycle.stage !== "questions" && cycle.stage !== "evidence") {
    throw new ApiError(409, "The analysis cycle cannot be generated");
  }
  const assessment = await db.query.assessments.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
  });
  if (!assessment) throw new ApiError(404, "Gap assessment not found");
  const assessmentRevisionId = cycle.assessmentRevisionId ?? (await finalizeAnswers({
    userId: input.userId,
    organizationId: input.organizationId,
    assessment,
    cycle,
    locale: input.locale,
  }));
  const [job] = await db.insert(backgroundJobs).values({
    organizationId: input.organizationId,
    kind: "gap_analysis",
    state: "queued",
    payload: {
      cycleId: cycle.id,
      locale: input.locale,
      definitionHash: cycle.definitionHash,
      buildHash: cycle.buildHash,
      idempotencyKey: input.idempotencyKey,
    },
    requestedBy: input.userId,
  }).returning();
  if (!job) throw new Error("Gap generation job was not created");
  await db.update(gapAnalysisCycles).set({
    stage: "generating",
    assessmentRevisionId,
    generationJobId: job.id,
    generationStartedAt: new Date(),
    questionsCompletedAt: cycle.questionsCompletedAt ?? new Date(),
    updatedAt: new Date(),
  }).where(eq(gapAnalysisCycles.id, cycle.id));
  return { job: toJobDto(job), reused: false };
}

export async function executeGapGenerationJob(input: {
  jobId: string;
  draftId?: string;
  cycleId?: string;
  userId: string;
  organizationId: string;
  workerId: string;
  locale: Locale;
  retryNonce?: string;
  abortSignal?: AbortSignal;
}) {
  if (input.abortSignal?.aborted) throw input.abortSignal.reason;
  const cycle = await requireCycle(input.organizationId, input.cycleId ?? input.draftId ?? "");
  if (cycle.stage === "generated" && cycle.outputRevisionId) {
    return { type: "analysis_output_revision", id: cycle.outputRevisionId };
  }
  if (cycle.stage !== "generating" || cycle.generationJobId !== input.jobId || !cycle.assessmentRevisionId) {
    throw new ApiError(409, "Gap analysis cycle is not ready for this job", undefined, "GAP_CYCLE_NOT_GENERATING");
  }
  const definition = getCurrentGapDefinition(input.locale);
  if (cycle.definitionHash !== currentGapDefinitionHash) {
    throw new ApiError(409, "The cycle definition is obsolete", undefined, "GAP_DEFINITION_CHANGED");
  }
  const answers = await db.select().from(assessmentAnswers)
    .where(eq(assessmentAnswers.assessmentRevisionId, cycle.assessmentRevisionId))
    .orderBy(asc(assessmentAnswers.position));
  const answerMap = Object.fromEntries(answers.map((answer) => [answer.questionKey, answer.answerValue]));
  const organization = await db.query.organizations.findFirst({
    where: { RAW: (table, operators) => eq(table.id, input.organizationId) ?? operators.sql`true` },
  });
  const selectedVersions = await db.select({ documentVersionId: gapAnalysisCycleDocuments.documentVersionId })
    .from(gapAnalysisCycleDocuments)
    .where(eq(gapAnalysisCycleDocuments.cycleId, cycle.id))
    .orderBy(asc(gapAnalysisCycleDocuments.position));
  const now = new Date();
  const manifest = {
    cycleId: cycle.id,
    assessmentRevisionId: cycle.assessmentRevisionId,
    documentVersionIds: selectedVersions.map((item) => item.documentVersionId),
    answers: answerMap,
  };
  const [run] = await db.insert(aiProcessingRuns).values({
    organizationId: input.organizationId,
    jobId: input.jobId,
    operationKind: "gap_analysis",
    status: "succeeded",
    provider: organization?.aiProviderMode ?? "company_hosted",
    model: "deterministic-gap-v1",
    promptName: definition.prompt.name,
    promptVersion: definition.prompt.version,
    promptHash: definition.prompt.templateHash,
    definitionHash: currentGapDefinitionHash,
    buildHash: BUILD_HASH,
    inputManifest: manifest,
    claimValidation: { version: 1, status: "validated", findingCount: definition.requirements.length },
    validatedOutput: { version: 1, requirementKeys: definition.requirements.map((item) => item.stableRequirementId) },
    outputLocale: input.locale,
    startedAt: now,
    completedAt: now,
  }).returning();
  if (!run) throw new Error("AI processing run was not created");
  const assessment = await db.query.assessments.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
  });
  if (!assessment) throw new Error("Gap assessment is missing");
  const applicability = await currentApplicabilityRevision(input.organizationId);
  if (!applicability) throw new ApiError(409, "Applicability lineage is unavailable");
  await db.insert(analysisOutputs).values({ organizationId: input.organizationId, kind: "gap" })
    .onConflictDoNothing({ target: [analysisOutputs.organizationId, analysisOutputs.kind] });
  const output = await db.query.analysisOutputs.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
  });
  if (!output) throw new Error("Gap output was not created");
  const evaluations = Object.fromEntries(definition.requirements.map((requirement) => {
    const requirementAnswers = requirement.questionStableKeys.map((key) => ({
      questionStableKey: key,
      stableValue: String(answerMap[key] ?? "unsure"),
    }));
    return [requirement.stableRequirementId, evaluateGapRequirement({
      gapAnalysisReleaseId: currentGapDefinitionHash,
      questionnaireVersionId: currentGapDefinitionHash,
      assessmentRevisionId: cycle.assessmentRevisionId!,
      requirementVersionId: requirement.stableRequirementId,
      answers: requirementAnswers,
    })];
  }));
  await db.update(assessmentRevisions).set({ deterministicEvaluations: evaluations })
    .where(eq(assessmentRevisions.id, cycle.assessmentRevisionId));
  const inputHash = hashJson(manifest);
  const [revision] = await db.insert(analysisOutputRevisions).values({
    organizationId: input.organizationId,
    outputId: output.id,
    previousRevisionId: output.currentRevisionId,
    assessmentRevisionId: cycle.assessmentRevisionId,
    sourceApplicabilityRevisionId: applicability.id,
    definitionHash: currentGapDefinitionHash,
    buildHash: BUILD_HASH,
    locale: input.locale,
    inputHash,
    result: { version: 1, evaluationKeys: Object.keys(evaluations) },
    generationJobId: input.jobId,
    aiProcessingRunId: run.id,
    createdBy: input.userId,
    createdAt: now,
  }).returning();
  if (!revision) throw new Error("Gap output revision was not created");
  await db.insert(gapFindings).values(definition.requirements.map((requirement, position) => {
    const evaluation = evaluations[requirement.stableRequirementId];
    return {
      organizationId: input.organizationId,
      outputRevisionId: revision.id,
      requirementKey: requirement.stableRequirementId,
      requirementTitle: requirement.title,
      requirementText: requirement.requirementText,
      icon: requirement.icon,
      criticality: requirement.criticality,
      status: evaluation.status,
      summary: summaryForStatus(evaluation.status, input.locale),
      guidance: guidanceForStatus(evaluation.status, input.locale),
      position,
    };
  }));
  const findings = await db.select().from(gapFindings).where(eq(gapFindings.outputRevisionId, revision.id));
  const actionable = findings.filter((finding) => finding.status !== "fulfilled");
  if (actionable.length) {
    await db.insert(gapItems).values(actionable.map((finding, position) => ({
      organizationId: input.organizationId,
      outputRevisionId: revision.id,
      findingId: finding.id,
      stableKey: `${finding.requirementKey}.gap.1`,
      kind: (finding.status === "insufficient_evidence"
        ? "uncertain"
        : finding.status === "partially_fulfilled"
          ? "partial"
          : "missing") as "uncertain" | "partial" | "missing",
      statement: finding.summary,
      recommendation: finding.guidance,
      position,
    })));
  }
  if (selectedVersions.length) {
    await db.insert(analysisOutputDocumentSources).values(selectedVersions.map((item, position) => ({
      organizationId: input.organizationId,
      outputRevisionId: revision.id,
      documentVersionId: item.documentVersionId,
      position,
    })));
  }
  await db.transaction(async (tx) => {
    await tx.update(analysisOutputs).set({ currentRevisionId: revision.id, updatedAt: now }).where(eq(analysisOutputs.id, output.id));
    await tx.update(assessments).set({ currentRevisionId: cycle.assessmentRevisionId, updatedAt: now }).where(eq(assessments.id, assessment.id));
    await tx.update(gapAnalysisCycles).set({ stage: "generated", outputRevisionId: revision.id, generatedAt: now, updatedAt: now }).where(eq(gapAnalysisCycles.id, cycle.id));
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap.generated",
      entityType: "analysis_output_revision",
      entityId: revision.id,
      metadata: { cycleId: cycle.id, definitionHash: currentGapDefinitionHash },
    });
  });
  return { type: "analysis_output_revision", id: revision.id };
}

async function finalizeAnswers(input: {
  userId: string;
  organizationId: string;
  assessment: typeof assessments.$inferSelect;
  cycle: typeof gapAnalysisCycles.$inferSelect;
  locale: Locale;
}) {
  const definition = getCurrentGapDefinition(input.locale);
  const answers = input.cycle.draftAnswers;
  for (const question of definition.questions) {
    if (question.required && typeof answers[question.stableKey] !== "string") {
      throw new ApiError(409, "All required Gap questions must be answered", { questionKey: question.stableKey }, "GAP_ANSWERS_INCOMPLETE");
    }
  }
  const [revision] = await db.insert(assessmentRevisions).values({
    organizationId: input.organizationId,
    assessmentId: input.assessment.id,
    previousRevisionId: input.assessment.currentRevisionId,
    definitionHash: currentGapDefinitionHash,
    buildHash: BUILD_HASH,
    locale: input.locale,
    deterministicEvaluations: {},
    inputHash: hashJson(answers),
    submittedBy: input.userId,
  }).returning();
  if (!revision) throw new Error("Gap assessment revision was not created");
  await db.insert(assessmentAnswers).values(definition.questions.flatMap((question) => {
    const value = answers[question.stableKey];
    if (typeof value !== "string") return [];
    const option = question.options.find((item) => item.stableValue === value);
    return [{
      organizationId: input.organizationId,
      assessmentRevisionId: revision.id,
      questionKey: question.stableKey,
      questionText: question.questionText,
      answerValue: value,
      selectedOptionLabels: option ? [option.label] : [],
      position: question.position,
    }];
  }));
  return revision.id;
}

async function readCycle(input: {
  organizationId: string;
  draftId?: string;
  assessmentId?: string;
  locale: Locale;
}) {
  const cycle = input.draftId
    ? await db.query.gapAnalysisCycles.findFirst({ where: { RAW: (table, operators) => and(eq(table.id, input.draftId!), eq(table.organizationId, input.organizationId)) ?? operators.sql`true` } })
    : await db.query.gapAnalysisCycles.findFirst({
        where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), ne(table.stage, "generated")) ?? operators.sql`true` },
        orderBy: { createdAt: "desc" },
      });
  if (!cycle) return null;
  const selected = await db.select({
    documentId: documentVersions.documentId,
    documentVersionId: documentVersions.id,
    position: gapAnalysisCycleDocuments.position,
  }).from(gapAnalysisCycleDocuments)
    .innerJoin(documentVersions, eq(documentVersions.id, gapAnalysisCycleDocuments.documentVersionId))
    .where(eq(gapAnalysisCycleDocuments.cycleId, cycle.id))
    .orderBy(asc(gapAnalysisCycleDocuments.position));
  const job = cycle.generationJobId ? await db.query.backgroundJobs.findFirst({
    where: { RAW: (table, operators) => eq(table.id, cycle.generationJobId!) ?? operators.sql`true` },
  }) : null;
  const assessment = await db.query.assessments.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
  });
  const legacyStatus = cycle.stage === "generated" ? "generated"
    : cycle.stage === "generating" && job?.state === "failed" ? "failed"
    : cycle.stage === "generating" && job?.state === "cancelled" ? "cancelled"
    : cycle.stage === "generating" ? "locked" : "open";
  return {
    cycle,
    draft: {
      id: cycle.id,
      organizationId: cycle.organizationId,
      assessmentId: assessment?.id ?? input.assessmentId ?? "",
      status: legacyStatus,
      outputLocale: cycle.locale,
      lockVersion: 1,
      generationJobId: cycle.generationJobId,
      outputGapRevisionId: cycle.outputRevisionId,
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
    },
    selected: selected.map((item) => ({
      draftId: cycle.id,
      organizationId: cycle.organizationId,
      documentId: item.documentId,
      documentVersionId: item.documentVersionId,
      selectionOrigin: "explicit_addition" as const,
      selectedBy: cycle.createdBy,
      selectedAt: cycle.updatedAt,
    })),
    summary: {
      baseAcceptedGapRevisionId: null,
      baseAcceptedGapRevisionNumber: null,
      assessmentRevisionId: cycle.assessmentRevisionId,
      assessmentRevisionNumber: null,
      gapAnalysisReleaseId: cycle.definitionHash,
      gapAnalysisReleaseVersion: getCurrentGapDefinition(input.locale).versionLabel,
      requirementCount: getCurrentGapDefinition(input.locale).requirements.length,
      carried: [],
      replaced: [],
      added: selected.map((item) => item.documentVersionId),
      removed: [],
      selectedDocumentVersionIds: selected.map((item) => item.documentVersionId),
    },
  };
}

async function replaceSelectedDocuments(organizationId: string, cycleId: string, documentIds: string[]) {
  const unique = [...new Set(documentIds)];
  const rows = unique.length ? await db.select({ id: documents.id, versionId: documents.currentVersionId, status: documentVersions.indexingStatus })
    .from(documents)
    .innerJoin(documentVersions, eq(documentVersions.id, documents.currentVersionId))
    .where(and(eq(documents.organizationId, organizationId), inArray(documents.id, unique))) : [];
  if (rows.length !== unique.length) throw new ApiError(400, "One or more selected documents are unavailable");
  const blocked = rows.filter((row) => row.status !== "succeeded");
  if (blocked.length) throw new ApiError(409, "Selected documents must finish indexing", { documentIds: blocked.map((row) => row.id) }, "GAP_DOCUMENT_NOT_READY");
  await db.transaction(async (tx) => {
    await tx.delete(gapAnalysisCycleDocuments).where(eq(gapAnalysisCycleDocuments.cycleId, cycleId));
    if (rows.length) await tx.insert(gapAnalysisCycleDocuments).values(rows.map((row, position) => ({
      organizationId,
      cycleId,
      documentVersionId: row.versionId!,
      position,
    })));
  });
}

async function prefillAnswers(revisionId: string | null) {
  if (!revisionId) return {};
  const revision = await db.query.assessmentRevisions.findFirst({
    where: { RAW: (table, operators) => eq(table.id, revisionId) ?? operators.sql`true` },
  });
  if (!revision || revision.definitionHash !== currentGapDefinitionHash) return {};
  const rows = await db.select({ key: assessmentAnswers.questionKey, value: assessmentAnswers.answerValue })
    .from(assessmentAnswers).where(eq(assessmentAnswers.assessmentRevisionId, revision.id));
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function requireGapAssessment(organizationId: string, assessmentId: string) {
  const row = await db.query.assessments.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, assessmentId), eq(table.organizationId, organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
  });
  if (!row) throw new ApiError(404, "Gap assessment not found");
  return row;
}

async function requireCycle(organizationId: string, cycleId: string) {
  const row = await db.query.gapAnalysisCycles.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, cycleId), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
  if (!row) throw new ApiError(404, "Gap analysis cycle not found", undefined, "GAP_CYCLE_NOT_FOUND");
  return row;
}

async function findUnfinishedCycle(organizationId: string) {
  return db.query.gapAnalysisCycles.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, organizationId), ne(table.stage, "generated")) ?? operators.sql`true` },
    orderBy: { createdAt: "desc" },
  });
}

async function currentApplicabilityRevision(organizationId: string) {
  const output = await db.query.analysisOutputs.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, organizationId), eq(table.kind, "applicability")) ?? operators.sql`true` },
  });
  if (!output?.currentRevisionId) return null;
  return db.query.analysisOutputRevisions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, output.currentRevisionId!), eq(table.organizationId, organizationId)) ?? operators.sql`true` },
  });
}

function toJobDto(job: typeof backgroundJobs.$inferSelect) {
  const completed = job.progressCurrent ?? 0;
  const total = job.progressTotal ?? 100;
  return {
    id: job.id,
    kind: job.kind,
    state: job.state === "leased" ? "running" as const : job.state,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    phase: null,
    completedUnits: job.progressCurrent,
    totalUnits: job.progressTotal,
    attemptCount: job.attemptCount,
    safeError: job.errorCode ? { code: job.errorCode, message: job.errorMessage ?? "Job failed" } : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    cancellable: ["queued", "leased", "running"].includes(job.state),
    resultLink: null,
  };
}

function summaryForStatus(status: string, locale: Locale) {
  const de: Record<string, string> = { fulfilled: "Die Anforderung ist erfüllt.", partially_fulfilled: "Die Anforderung ist teilweise erfüllt.", not_fulfilled: "Die Anforderung ist nicht erfüllt.", insufficient_evidence: "Die Nachweislage ist nicht ausreichend." };
  const en: Record<string, string> = { fulfilled: "The requirement is fulfilled.", partially_fulfilled: "The requirement is partially fulfilled.", not_fulfilled: "The requirement is not fulfilled.", insufficient_evidence: "The available evidence is insufficient." };
  return (locale === "de" ? de : en)[status] ?? status;
}

function guidanceForStatus(status: string, locale: Locale) {
  if (status === "fulfilled") return locale === "de" ? "Kontrollen beibehalten und regelmäßig prüfen." : "Maintain the controls and review them regularly.";
  return locale === "de" ? "Dokumentierte Maßnahmen zur Schließung dieser Lücke planen." : "Plan documented measures to close this gap.";
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
