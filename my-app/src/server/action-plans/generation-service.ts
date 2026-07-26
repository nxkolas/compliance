import { db } from "@/src/db";
import {
  actionPlanItemGaps,
  actionPlanItems,
  actionPlans,
  aiProcessingRunAssessmentInputs,
  aiProcessingRunDocumentInputs,
  aiProcessingRuns,
  assessmentAnswerOptions,
  auditEvents,
  backgroundJobs,
  generatedArtifactRevisions,
  generatedArtifacts,
  questionOptions,
} from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { contentHash } from "@/src/server/compliance";
import { runGroundedOperation } from "../ai/grounding/gateway";
import type { GroundingContextItem } from "../ai/grounding/types";
import { ApiError } from "../api/errors";
import { enqueueJob } from "../jobs";
import { assertCanManageOrganization } from "../organizations/service";
import {
  assertGapRevisionApprovable,
  getGapRevisionStaleness,
  loadGapAnalysisRelease,
  readGapRevisionMetadata,
} from "../gap-analysis";
import {
  buildActionPlanResponseSchema,
  normalizeActionPlanResponse,
  type ActionPlanCategoryPolicy,
  type ActionPlanModelResponse,
  type ValidatedActionPlanContent,
} from "./generation-schema";
import { ACTION_PLAN_GENERATION_JOB_POLICY } from "./domain";
import {
  ACTION_PLAN_PROMPT_NAME,
  ACTION_PLAN_PROMPT_TEMPLATE,
  ACTION_PLAN_PROMPT_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_VERSION,
  buildActionPlanCategoryQuery,
} from "./prompt-contract";

const ACTIVE_JOB_STATES = [
  "queued",
  "running",
  "cancellation_requested",
] as const;

export async function enqueueActionPlanGeneration(input: {
  userId: string;
  organizationId: string;
  sourceGapRevisionId: string;
  publishedReleaseQa?: true;
}) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const snapshot = await loadSourceSnapshot({
    userId: input.userId,
    organizationId: input.organizationId,
    sourceGapRevisionId: input.sourceGapRevisionId,
  });
  const existingPlan = await db.query.actionPlans.findFirst({
    columns: { id: true },
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, input.organizationId) ?? operators.sql`true`,
    },
  });
  if (existingPlan) {
    throw new ApiError(
      409,
      "An action plan already exists",
      { actionPlanId: existingPlan.id },
      "ACTION_PLAN_ALREADY_EXISTS",
    );
  }
  const existingJob = await db.query.backgroundJobs.findFirst({
    columns: {
      id: true,
      organizationId: true,
      requestedByUserId: true,
      kind: true,
      state: true,
      payload: true,
      progress: true,
      attemptCount: true,
      maxAttempts: true,
      cancellable: true,
      cancellationCapability: true,
      safeErrorCode: true,
      safeErrorMessage: true,
      runAfter: true,
      leaseOwner: true,
      leaseExpiresAt: true,
      heartbeatAt: true,
      cancellationRequestedAt: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, input.organizationId),
          eq(table.kind, "action-plan-generation"),
          operators.inArray(table.state, [...ACTIVE_JOB_STATES]),
        ) ?? operators.sql`true`,
    },
  });
  if (existingJob) {
    throw new ApiError(
      409,
      "Action Plan generation is already in progress",
      { backgroundJobId: existingJob.id },
      "ACTION_PLAN_GENERATION_IN_PROGRESS",
    );
  }
  return enqueueJob({
    kind: "action-plan-generation",
    payload: {
      sourceGapRevisionId: snapshot.revision.id,
      locale: snapshot.locale,
      ...(input.publishedReleaseQa ? { publishedReleaseQa: true } : {}),
    },
    organizationId: input.organizationId,
    requestedByUserId: input.userId,
    ...ACTION_PLAN_GENERATION_JOB_POLICY,
  });
}

export async function generateActionPlanContent(input: {
  actor: { userId: string };
  organizationId: string;
  sourceGapRevisionId: string;
  outputLocale: "de" | "en";
  jobId: string;
  idempotencyKey: string;
}): Promise<{
  runId: string | null;
  content: ValidatedActionPlanContent;
}> {
  const snapshot = await loadSourceSnapshot({
    userId: input.actor.userId,
    organizationId: input.organizationId,
    sourceGapRevisionId: input.sourceGapRevisionId,
  });
  if (snapshot.locale !== input.outputLocale) {
    throw new ApiError(
      409,
      "Action Plan locale conflicts with its source Gap Analysis",
      undefined,
      "GAP_OUTPUT_LOCALE_CONFLICT",
    );
  }
  if (snapshot.gaps.length === 0) {
    return { runId: null, content: { categories: [] } };
  }
  assertActionPrompt(snapshot.release);
  const answerRows = await db.query.assessmentAnswers.findMany({
    columns: {
      id: true,
      questionId: true,
      questionStableKey: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.assessmentRevisionId, snapshot.assessmentRevisionId) ??
        operators.sql`true`,
    },
  });
  const selectedOptions = answerRows.length
    ? await db
        .select({
          answerId: assessmentAnswerOptions.assessmentAnswerId,
          stableValue: questionOptions.stableValue,
        })
        .from(assessmentAnswerOptions)
        .innerJoin(
          questionOptions,
          eq(assessmentAnswerOptions.questionOptionId, questionOptions.id),
        )
        .where(
          inArray(
            assessmentAnswerOptions.assessmentAnswerId,
            answerRows.map((answer) => answer.id),
          ),
        )
    : [];
  const categoryInputs = snapshot.findings.flatMap((finding) => {
    const requirement = snapshot.release.requirements.find(
      (candidate) => candidate.id === finding.requirementVersionId,
    );
    if (!requirement) {
      throw new ApiError(
        409,
        "Pinned requirement is unavailable",
        undefined,
        "GAP_INPUT_SNAPSHOT_INVALID",
      );
    }
    const gaps = snapshot.gaps
      .filter((gap) => gap.findingId === finding.id)
      .sort((left, right) => left.position - right.position);
    if (gaps.length === 0) return [];
    return [
      {
        finding,
        requirement,
        gaps: gaps.map((gap) => ({
          row: gap,
          key: `G${gap.position}`,
        })),
      },
    ];
  });
  const questionnaireAssertions = categoryInputs.flatMap((category) =>
    answerRows
      .filter((answer) =>
        category.requirement.questionStableKeys.includes(
          answer.questionStableKey,
        ),
      )
      .map((answer) => ({
        answerId: answer.id,
        queryUnitId: category.requirement.code,
        excerpt: `${
          snapshot.release.questions.find(
            (question) => question.id === answer.questionId,
          )?.questionText ?? answer.questionStableKey
        }: ${
          selectedOptions.find((option) => option.answerId === answer.id)
            ?.stableValue ?? ""
        }`,
      })),
  );
  const queryUnits = categoryInputs.map((category) => {
    const questions = category.requirement.questionStableKeys.map(
      (stableKey) => {
        const question = snapshot.release.questions.find(
          (candidate) => candidate.stableKey === stableKey,
        );
        const answer = answerRows.find(
          (candidate) => candidate.questionStableKey === stableKey,
        );
        return {
          question: question?.questionText ?? stableKey,
          answer:
            selectedOptions.find((option) => option.answerId === answer?.id)
              ?.stableValue ?? "missing",
          satisfied:
            selectedOptions.find((option) => option.answerId === answer?.id)
              ?.stableValue === "fully_implemented",
        };
      },
    );
    const mappedProvisions = category.requirement.questionStableKeys.flatMap(
      (stableKey) =>
        snapshot.release.questions.find(
          (question) => question.stableKey === stableKey,
        )?.legalProvisions ?? [],
    );
    return {
      id: category.requirement.code,
      query: buildActionPlanCategoryQuery({
        requirement: category.requirement,
        gaps: category.gaps.map((gap) => ({
          key: gap.key,
          kind: gap.row.kind,
          statement: gap.row.statement,
        })),
        questionsAndAnswers: questions,
      }),
      retrievalQuery: [
        category.requirement.title,
        category.requirement.requirementText,
        ...category.gaps.map((gap) => gap.row.statement),
        ...questions.map((question) => question.question),
      ].join("\n"),
      preferredMappedLegalProvisionIds: [
        ...new Set(mappedProvisions.map((provision) => provision.id)),
      ],
      preferredMappedLegalProvisionKeys: [
        ...new Set(mappedProvisions.map((provision) => provision.key)),
      ],
      legalTierLimits: {
        primary_authority: 0,
        official_guidance: 0,
        curated_secondary: 0,
      },
    };
  });
  let policies: ActionPlanCategoryPolicy[] = [];
  const grounded = await runGroundedOperation<ActionPlanModelResponse>({
    operation: "gap_analysis",
    runOperationKind: "action_plan_generation",
    actor: input.actor,
    organizationId: input.organizationId,
    outputLocale: input.outputLocale,
    workflowReleaseId: snapshot.release.id,
    asOfDate: new Date().toISOString().slice(0, 10),
    organizationEvidenceVersionIds: snapshot.documentVersionIds,
    questionnaireAssertions,
    queryUnits,
    systemInstruction: ACTION_PLAN_PROMPT_TEMPLATE,
    outputContract: {
      schema(context) {
        policies = buildPolicies(categoryInputs, context, input.outputLocale);
        return buildActionPlanResponseSchema(policies);
      },
      languagePolicy: "localized",
      generatedProse: (value) =>
        Object.values(value.categories).flatMap((category) =>
          category.actions.flatMap((action) => [
            action.title,
            action.result,
            ...action.suggestedEvidence,
          ]),
        ),
      claims(value) {
        return normalizeActionPlanResponse({
          value,
          policies,
        }).categories.flatMap((category) =>
          category.actions.map((action) => ({
            key: `action-plan:${category.requirementCode}:${action.position}`,
            queryUnitId: category.requirementCode,
            kind: "legal" as const,
            binding: true,
            citationIds: action.citationIds,
            text: `${action.title}. ${action.result}`,
          })),
        );
      },
    },
    idempotencyKey: input.idempotencyKey,
    assessmentRevisionId: snapshot.assessmentRevisionId,
    jobId: input.jobId,
    promptMetadata: {
      name: ACTION_PLAN_PROMPT_NAME,
      version: ACTION_PLAN_PROMPT_VERSION,
      templateHash: ACTION_PLAN_PROMPT_TEMPLATE_HASH,
      responseSchemaVersion: ACTION_PLAN_RESPONSE_SCHEMA_VERSION,
    },
  });
  if (policies.length === 0) {
    policies = buildPolicies(
      categoryInputs,
      grounded.context,
      input.outputLocale,
    );
  }
  await Promise.all([
    db
      .insert(aiProcessingRunAssessmentInputs)
      .values({
        runId: grounded.runId,
        assessmentRevisionId: snapshot.assessmentRevisionId,
        sourceHash: contentHash({
          answers: answerRows,
          options: selectedOptions,
        }),
      })
      .onConflictDoNothing(),
    snapshot.documentVersions.length
      ? db
          .insert(aiProcessingRunDocumentInputs)
          .values(
            snapshot.documentVersions.map((documentVersion) => ({
              runId: grounded.runId,
              documentVersionId: documentVersion.id,
              sourceHash: documentVersion.contentHash,
            })),
          )
          .onConflictDoNothing()
      : Promise.resolve(),
  ]);
  return {
    runId: grounded.runId,
    content: normalizeActionPlanResponse({
      value: grounded.output,
      policies,
    }),
  };
}

export async function activateGeneratedActionPlan(input: {
  userId: string;
  organizationId: string;
  sourceGapRevisionId: string;
  jobId: string;
  runId: string | null;
  content: ValidatedActionPlanContent;
  publishedReleaseQa?: true;
}) {
  const existing = await db.query.actionPlans.findFirst({
    columns: { id: true },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.generationJobId, input.jobId),
          eq(table.organizationId, input.organizationId),
        ) ?? operators.sql`true`,
    },
  });
  if (existing) return existing;
  const snapshot = await loadSourceSnapshot({
    userId: input.userId,
    organizationId: input.organizationId,
    sourceGapRevisionId: input.sourceGapRevisionId,
  });
  validateContentAgainstSnapshot(input.content, snapshot);
  if ((snapshot.gaps.length === 0) !== (input.runId === null)) {
    throw new ApiError(
      409,
      "Action Plan generation provenance does not match its content",
      undefined,
      "ACTION_PLAN_GENERATION_PROVENANCE_INVALID",
    );
  }
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select({
        id: backgroundJobs.id,
        state: backgroundJobs.state,
        kind: backgroundJobs.kind,
        organizationId: backgroundJobs.organizationId,
        payload: backgroundJobs.payload,
      })
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, input.jobId))
      .limit(1)
      .for("update");
    if (
      !job ||
      job.kind !== "action-plan-generation" ||
      job.organizationId !== input.organizationId
    ) {
      throw new ApiError(
        409,
        "Action Plan generation reservation is invalid",
        undefined,
        "ACTION_PLAN_GENERATION_RESERVATION_INVALID",
      );
    }
    const jobUsesPublishedReleaseQa =
      (job.payload as { publishedReleaseQa?: unknown }).publishedReleaseQa ===
      true;
    if (jobUsesPublishedReleaseQa !== Boolean(input.publishedReleaseQa)) {
      throw new ApiError(
        409,
        "Action Plan generation QA reservation is invalid",
        undefined,
        "ACTION_PLAN_GENERATION_RESERVATION_INVALID",
      );
    }
    if (job.state === "cancellation_requested" || job.state === "cancelled") {
      const cancellation = new Error(
        "Action Plan generation was cancelled before persistence",
      );
      cancellation.name = "JobCancellationError";
      throw cancellation;
    }
    if (job.state !== "running") {
      throw new ApiError(
        409,
        "Action Plan generation no longer owns persistence",
        undefined,
        "ACTION_PLAN_GENERATION_RESERVATION_INVALID",
      );
    }
    const [artifact] = await tx
      .select({
        id: generatedArtifacts.id,
        currentRevisionId: generatedArtifacts.currentRevisionId,
      })
      .from(generatedArtifacts)
      .where(
        and(
          eq(generatedArtifacts.organizationId, input.organizationId),
          eq(generatedArtifacts.artifactType, "gap_analysis_result"),
        ),
      )
      .limit(1)
      .for("update");
    if (artifact?.currentRevisionId !== input.sourceGapRevisionId) {
      throw new ApiError(
        409,
        "Only the current Gap Analysis can create an Action Plan",
        undefined,
        "GAP_REVISION_NOT_CURRENT",
      );
    }
    const materialized = await tx.query.actionPlans.findFirst({
      columns: { id: true },
      where: {
        RAW: (table, operators) =>
          eq(table.generationJobId, input.jobId) ?? operators.sql`true`,
      },
    });
    if (materialized) return materialized;
    const activeRelease = await tx.query.activeGapAnalysisReleases.findFirst({
      columns: { gapAnalysisReleaseId: true },
      where: {
        RAW: (table, operators) =>
          eq(table.releaseCode, snapshot.release.releaseCode) ??
          operators.sql`true`,
      },
    });
    if (
      !input.publishedReleaseQa &&
      activeRelease?.gapAnalysisReleaseId !== snapshot.release.id
    ) {
      throw new ApiError(
        409,
        "The pinned Gap release is no longer active",
        undefined,
        "GAP_RELEASE_OUTDATED",
      );
    }
    if (input.runId) {
      const run = await tx.query.aiProcessingRuns.findFirst({
        columns: {
          id: true,
          organizationId: true,
          assessmentRevisionId: true,
          operationKind: true,
          status: true,
          jobId: true,
        },
        where: {
          RAW: (table, operators) =>
            eq(table.id, input.runId!) ?? operators.sql`true`,
        },
      });
      if (
        !run ||
        run.organizationId !== input.organizationId ||
        run.assessmentRevisionId !== snapshot.assessmentRevisionId ||
        run.operationKind !== "action_plan_generation" ||
        run.status !== "processing" ||
        run.jobId !== input.jobId
      ) {
        throw new ApiError(
          409,
          "Action Plan generation provenance is invalid",
          undefined,
          "ACTION_PLAN_GENERATION_PROVENANCE_INVALID",
        );
      }
    }
    const anyPlan = await tx.query.actionPlans.findFirst({
      columns: { id: true },
      where: {
        RAW: (table, operators) =>
          eq(table.organizationId, input.organizationId) ?? operators.sql`true`,
      },
    });
    if (anyPlan) {
      throw new ApiError(
        409,
        "An action plan already exists",
        { actionPlanId: anyPlan.id },
        "ACTION_PLAN_ALREADY_EXISTS",
      );
    }
    const approvedAt = new Date();
    const [approved] = await tx
      .update(generatedArtifactRevisions)
      .set({
        status: "approved",
        approvedBy: input.userId,
        approvedAt,
      })
      .where(
        and(
          eq(generatedArtifactRevisions.id, input.sourceGapRevisionId),
          inArray(generatedArtifactRevisions.status, ["generated", "reviewed"]),
        ),
      )
      .returning({ id: generatedArtifactRevisions.id });
    if (!approved) {
      throw new ApiError(
        409,
        "The Gap Analysis is no longer finalizable",
        undefined,
        "GAP_REVISION_NOT_CURRENT",
      );
    }
    const [accepted] = await tx
      .update(generatedArtifacts)
      .set({ acceptedRevisionId: input.sourceGapRevisionId })
      .where(
        and(
          eq(generatedArtifacts.id, artifact.id),
          eq(generatedArtifacts.currentRevisionId, input.sourceGapRevisionId),
        ),
      )
      .returning({ id: generatedArtifacts.id });
    if (!accepted) {
      throw new ApiError(
        409,
        "The Gap Analysis changed before finalization",
        undefined,
        "GAP_REVISION_NOT_CURRENT",
      );
    }
    const [plan] = await tx
      .insert(actionPlans)
      .values({
        organizationId: input.organizationId,
        sourceGapArtifactRevisionId: input.sourceGapRevisionId,
        outputLocale: snapshot.locale,
        generationRunId: input.runId,
        generationJobId: input.jobId,
        revisionNumber: 1,
        activatedBy: input.userId,
        activatedAt: approvedAt,
        createdBy: input.userId,
      })
      .returning();
    if (!plan) throw new Error("Could not activate Action Plan");
    const gapByFindingAndKey = new Map(
      snapshot.gaps.map((gap) => [`${gap.findingId}:G${gap.position}`, gap]),
    );
    for (const category of input.content.categories) {
      for (const action of category.actions) {
        const [storedAction] = await tx
          .insert(actionPlanItems)
          .values({
            actionPlanId: plan.id,
            sourceFindingId: category.sourceFindingId,
            title: action.title,
            result: action.result,
            suggestedEvidence: action.suggestedEvidence,
            position: action.position,
            executionNotes: "",
            priority: action.priority,
            status: "open",
          })
          .returning({ id: actionPlanItems.id });
        if (!storedAction) throw new Error("Could not store generated action");
        await tx.insert(actionPlanItemGaps).values(
          action.gapKeys.map((gapKey) => ({
            actionPlanItemId: storedAction.id,
            gapItemId: requireMapValue(
              gapByFindingAndKey,
              `${category.sourceFindingId}:${gapKey}`,
            ).id,
            sourceFindingId: category.sourceFindingId,
          })),
        );
      }
    }
    if (input.runId) {
      await tx
        .update(aiProcessingRuns)
        .set({ status: "succeeded", completedAt: approvedAt })
        .where(
          and(
            eq(aiProcessingRuns.id, input.runId),
            eq(aiProcessingRuns.status, "processing"),
          ),
        );
    }
    await tx.insert(auditEvents).values([
      {
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "gap_revision.approved",
        entityType: "generated_artifact_revision",
        entityId: input.sourceGapRevisionId,
        metadata: { actionPlanId: plan.id },
      },
      {
        organizationId: input.organizationId,
        actorUserId: input.userId,
        eventType: "action_plan.generated",
        entityType: "action_plan",
        entityId: plan.id,
        metadata: {
          sourceGapArtifactRevisionId: input.sourceGapRevisionId,
          generationRunId: input.runId,
          generationJobId: input.jobId,
          itemCount: input.content.categories.reduce(
            (count, category) => count + category.actions.length,
            0,
          ),
        },
      },
    ]);
    return plan;
  });
}

export async function executeActionPlanGenerationJob(input: {
  jobId: string;
  organizationId: string;
  userId: string;
  sourceGapRevisionId: string;
  locale: "de" | "en";
  publishedReleaseQa?: true;
  attemptCount?: number;
}) {
  const existing = await db.query.actionPlans.findFirst({
    columns: { id: true },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.generationJobId, input.jobId),
          eq(table.organizationId, input.organizationId),
        ) ?? operators.sql`true`,
    },
  });
  if (existing) return { type: "action_plan", id: existing.id };
  const generated = await generateActionPlanContent({
    actor: { userId: input.userId },
    organizationId: input.organizationId,
    sourceGapRevisionId: input.sourceGapRevisionId,
    outputLocale: input.locale,
    jobId: input.jobId,
    idempotencyKey: contentHash({
      operation: "action_plan_generation",
      sourceGapRevisionId: input.sourceGapRevisionId,
      jobId: input.jobId,
      publishedReleaseQa: input.publishedReleaseQa,
      attemptCount: input.attemptCount ?? 1,
    }),
  });
  const plan = await activateGeneratedActionPlan({
    userId: input.userId,
    organizationId: input.organizationId,
    sourceGapRevisionId: input.sourceGapRevisionId,
    jobId: input.jobId,
    runId: generated.runId,
    content: generated.content,
    publishedReleaseQa: input.publishedReleaseQa,
  });
  return { type: "action_plan", id: plan.id };
}

function buildPolicies(
  categories: Array<{
    finding: { id: string; severity: "low" | "medium" | "high" | "critical" };
    requirement: { code: string };
    gaps: Array<{
      key: string;
      row: {
        kind: "missing" | "partial" | "uncertain";
      };
    }>;
  }>,
  context: GroundingContextItem[],
  outputLocale: "de" | "en",
): ActionPlanCategoryPolicy[] {
  return categories.map((category) => ({
    requirementCode: category.requirement.code,
    sourceFindingId: category.finding.id,
    priority: category.finding.severity,
    outputLocale,
    gaps: category.gaps.map((gap) => ({
      key: gap.key,
      kind: gap.row.kind,
    })),
    permittedCitationIds: context
      .filter((item) => item.queryUnitId === category.requirement.code)
      .map((item) => item.citationId),
  }));
}

async function loadSourceSnapshot(input: {
  userId: string;
  organizationId: string;
  sourceGapRevisionId: string;
}) {
  const staleness = await getGapRevisionStaleness({
    userId: input.userId,
    organizationId: input.organizationId,
    revisionId: input.sourceGapRevisionId,
  });
  if (staleness.stale || staleness.outdatedRelease || staleness.archived) {
    throw new ApiError(
      409,
      "The Gap Analysis inputs are no longer current",
      { staleness },
      "GAP_SOURCES_STALE",
    );
  }
  const [row] = await db
    .select({
      artifact: generatedArtifacts,
      revision: generatedArtifactRevisions,
    })
    .from(generatedArtifactRevisions)
    .innerJoin(
      generatedArtifacts,
      eq(generatedArtifactRevisions.artifactId, generatedArtifacts.id),
    )
    .where(
      and(
        eq(generatedArtifactRevisions.id, input.sourceGapRevisionId),
        eq(generatedArtifacts.organizationId, input.organizationId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
      ),
    )
    .limit(1);
  if (
    !row?.revision.gapAnalysisReleaseId ||
    row.artifact.currentRevisionId !== row.revision.id ||
    (row.revision.outputLocale !== "de" && row.revision.outputLocale !== "en")
  ) {
    throw new ApiError(
      409,
      "Only the current Gap Analysis can create an Action Plan",
      undefined,
      "GAP_REVISION_NOT_CURRENT",
    );
  }
  const locale = row.revision.outputLocale;
  if (readGapRevisionMetadata(row.revision.result).outputLocale !== locale) {
    throw new ApiError(
      409,
      "Gap result language metadata is invalid",
      undefined,
      "GAP_OUTPUT_LOCALE_INVALID",
    );
  }
  const release = await loadGapAnalysisRelease(
    row.revision.gapAnalysisReleaseId,
    locale,
  );
  if (!release) {
    throw new ApiError(
      409,
      "Pinned Gap release is unavailable",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  const findings = await db.query.gapFindings.findMany({
    columns: {
      id: true,
      requirementVersionId: true,
      status: true,
      evidenceSufficiency: true,
      severity: true,
      statementBasis: true,
      requiresReview: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.artifactRevisionId, row.revision.id) ?? operators.sql`true`,
    },
  });
  const evidence = findings.length
    ? await db.query.gapFindingEvidence.findMany({
        columns: {
          findingId: true,
          citationId: true,
          sourceType: true,
        },
        where: {
          RAW: (table, operators) =>
            inArray(
              table.findingId,
              findings.map((finding) => finding.id),
            ) ?? operators.sql`true`,
        },
      })
    : [];
  const gaps = findings.length
    ? await db.query.gapItems.findMany({
        columns: {
          id: true,
          findingId: true,
          sourceAssessmentAnswerId: true,
          questionStableKey: true,
          kind: true,
          statement: true,
          position: true,
        },
        where: {
          RAW: (table, operators) =>
            inArray(
              table.findingId,
              findings.map((finding) => finding.id),
            ) ?? operators.sql`true`,
        },
        orderBy: { position: "asc" },
      })
    : [];
  assertGapRevisionApprovable({
    expectedRequirementVersionIds: release.requirements.map(
      (requirement) => requirement.id,
    ),
    findings,
    evidence,
    gaps,
  });
  const assessmentSources =
    await db.query.artifactRevisionAssessmentSources.findMany({
      columns: { assessmentRevisionId: true },
      where: {
        RAW: (table, operators) =>
          eq(table.artifactRevisionId, row.revision.id) ?? operators.sql`true`,
      },
    });
  if (assessmentSources.length !== 1) {
    throw new ApiError(
      409,
      "Gap revision assessment source is invalid",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  const documentSources =
    await db.query.artifactRevisionDocumentSources.findMany({
      columns: { documentVersionId: true },
      where: {
        RAW: (table, operators) =>
          eq(table.artifactRevisionId, row.revision.id) ?? operators.sql`true`,
      },
    });
  const pinnedDocumentVersions = documentSources.length
    ? await db.query.documentVersions.findMany({
        columns: { id: true, contentHash: true },
        where: {
          RAW: (table, operators) =>
            inArray(
              table.id,
              documentSources.map((source) => source.documentVersionId),
            ) ?? operators.sql`true`,
        },
      })
    : [];
  if (pinnedDocumentVersions.length !== documentSources.length) {
    throw new ApiError(
      409,
      "A pinned organization document is unavailable",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  return {
    revision: row.revision,
    locale,
    release,
    findings,
    gaps,
    assessmentRevisionId: assessmentSources[0]!.assessmentRevisionId,
    documentVersionIds: documentSources.map(
      (source) => source.documentVersionId,
    ),
    documentVersions: pinnedDocumentVersions,
  };
}

function validateContentAgainstSnapshot(
  content: ValidatedActionPlanContent,
  snapshot: Awaited<ReturnType<typeof loadSourceSnapshot>>,
) {
  const actionableFindings = snapshot.findings.filter((finding) =>
    snapshot.gaps.some((gap) => gap.findingId === finding.id),
  );
  if (
    content.categories.length !== actionableFindings.length ||
    actionableFindings.some(
      (finding) =>
        !content.categories.some(
          (category) => category.sourceFindingId === finding.id,
        ),
    )
  ) {
    throw new ApiError(
      422,
      "Generated Action Plan category coverage is invalid",
      undefined,
      "ACTION_PLAN_COVERAGE_INVALID",
    );
  }
  for (const category of content.categories) {
    const gaps = snapshot.gaps.filter(
      (gap) => gap.findingId === category.sourceFindingId,
    );
    const finding = actionableFindings.find(
      (candidate) => candidate.id === category.sourceFindingId,
    );
    const allowed = new Set(gaps.map((gap) => `G${gap.position}`));
    const covered = new Set(
      category.actions.flatMap((action) => action.gapKeys),
    );
    if (
      category.actions.length < 1 ||
      category.actions.length > 10 ||
      category.actions.some(
        (action, index) =>
          action.position !== index + 1 ||
          action.priority !== finding?.severity ||
          action.gapKeys.length < 1 ||
          action.gapKeys.some((key) => !allowed.has(key)),
      ) ||
      [...allowed].some((key) => !covered.has(key))
    ) {
      throw new ApiError(
        422,
        "Generated Action Plan gap coverage is invalid",
        undefined,
        "ACTION_PLAN_COVERAGE_INVALID",
      );
    }
  }
}

function assertActionPrompt(release: {
  actionPlanPrompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
}) {
  if (
    release.actionPlanPrompt.name !== ACTION_PLAN_PROMPT_NAME ||
    release.actionPlanPrompt.version !== ACTION_PLAN_PROMPT_VERSION ||
    release.actionPlanPrompt.templateHash !==
      ACTION_PLAN_PROMPT_TEMPLATE_HASH ||
    release.actionPlanPrompt.responseSchemaVersion !==
      ACTION_PLAN_RESPONSE_SCHEMA_VERSION
  ) {
    throw new ApiError(
      409,
      "Pinned Action Plan prompt contract is unsupported",
      undefined,
      "ACTION_PLAN_PROMPT_UNSUPPORTED",
    );
  }
}

function requireMapValue<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (!value) throw new Error(`Required value ${String(key)} is missing`);
  return value;
}
