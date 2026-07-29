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
  backgroundJobResults,
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
import {
  ACTION_PLAN_GENERATION_JOB_KINDS,
  actionPlanGenerationJobKind,
  enqueueJob,
  isActionPlanGenerationJobKind,
} from "../jobs";
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
import {
  buildActionPlanCategoryResponseSchemaV2,
  normalizeActionPlanCategoryResponseV2,
  type ActionPlanCategoryPolicyV2,
  type ActionPlanCategoryResponseV2,
} from "./generation-schema-v2";
import {
  ACTION_PLAN_PROMPT_V2_NAME,
  ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V2_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V2_VERSION,
  actionPlanPromptV2,
  actionPlanRepairPromptV2,
} from "./prompt-contract-v2";
import {
  buildActionPlanCategoryResponseSchemaV3,
  normalizeActionPlanCategoryResponseV3,
  type ActionPlanCategoryPolicyV3,
} from "./generation-schema-v3";
import {
  ACTION_PLAN_PROMPT_V3_NAME,
  ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V3_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V3_VERSION,
  actionPlanPromptV3,
  actionPlanRepairPromptV3,
} from "./prompt-contract-v3";
import {
  buildActionPlanCategoryResponseSchemaV4,
  normalizeActionPlanCategoryResponseV4,
  type ActionPlanCategoryPolicyV4,
} from "./generation-schema-v4";
import {
  ACTION_PLAN_PROMPT_V4_NAME,
  ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V4_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V4_VERSION,
  actionPlanPromptV4,
  actionPlanRepairPromptV4,
} from "./prompt-contract-v4";
import {
  buildActionPlanCategoryResponseSchemaV5,
  normalizeActionPlanCategoryResponseV5,
  type ActionPlanCategoryPolicyV5,
} from "./generation-schema-v5";
import {
  ACTION_PLAN_PROMPT_V5_NAME,
  ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V5_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V5_VERSION,
  actionPlanPromptV5,
  actionPlanRepairPromptV5,
} from "./prompt-contract-v5";
import {
  buildActionPlanCategoryResponseSchemaV6,
  normalizeActionPlanCategoryResponseV6,
  type ActionPlanCategoryPolicyV6,
} from "./generation-schema-v6";
import {
  ACTION_PLAN_PROMPT_V6_NAME,
  ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V6_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION,
  actionPlanPromptV6,
  actionPlanRepairPromptV6,
} from "./prompt-contract-v6";
import {
  coordinateCategoryGeneration,
  safeGenerationIssues,
} from "../ai/generation";

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
    publishedReleaseQa: input.publishedReleaseQa,
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
          operators.inArray(table.kind, [...ACTION_PLAN_GENERATION_JOB_KINDS]),
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
    kind: actionPlanGenerationJobKind(
      snapshot.release.actionPlanPrompt.responseSchemaVersion,
    ),
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
  abortSignal?: AbortSignal;
  publishedReleaseQa?: true;
}): Promise<{
  runId: string | null;
  runIds?: string[];
  content: ValidatedActionPlanContent;
}> {
  const snapshot = await loadSourceSnapshot({
    userId: input.actor.userId,
    organizationId: input.organizationId,
    sourceGapRevisionId: input.sourceGapRevisionId,
    publishedReleaseQa: input.publishedReleaseQa,
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
  if (
    snapshot.release.actionPlanPrompt.version ===
      ACTION_PLAN_PROMPT_V6_VERSION &&
    snapshot.release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION &&
    snapshot.release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH
  ) {
    return generateActionPlanCategoriesVersioned(
      {
        input,
        snapshot,
        categoryInputs,
        questionnaireAssertions,
        queryUnits,
        answerRows,
        selectedOptions,
      },
      "6",
    );
  }
  if (
    snapshot.release.actionPlanPrompt.version ===
      ACTION_PLAN_PROMPT_V5_VERSION &&
    snapshot.release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V5_VERSION &&
    snapshot.release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH
  ) {
    return generateActionPlanCategoriesVersioned(
      {
        input,
        snapshot,
        categoryInputs,
        questionnaireAssertions,
        queryUnits,
        answerRows,
        selectedOptions,
      },
      "5",
    );
  }
  if (
    snapshot.release.actionPlanPrompt.version ===
      ACTION_PLAN_PROMPT_V4_VERSION &&
    snapshot.release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V4_VERSION &&
    snapshot.release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH
  ) {
    return generateActionPlanCategoriesVersioned(
      {
        input,
        snapshot,
        categoryInputs,
        questionnaireAssertions,
        queryUnits,
        answerRows,
        selectedOptions,
      },
      "4",
    );
  }
  if (
    snapshot.release.actionPlanPrompt.version ===
      ACTION_PLAN_PROMPT_V3_VERSION &&
    snapshot.release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V3_VERSION &&
    snapshot.release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH
  ) {
    return generateActionPlanCategoriesVersioned(
      {
        input,
        snapshot,
        categoryInputs,
        questionnaireAssertions,
        queryUnits,
        answerRows,
        selectedOptions,
      },
      "3",
    );
  }
  if (
    snapshot.release.actionPlanPrompt.version ===
      ACTION_PLAN_PROMPT_V2_VERSION &&
    snapshot.release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V2_VERSION &&
    snapshot.release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH
  ) {
    return generateActionPlanCategoriesVersioned(
      {
        input,
        snapshot,
        categoryInputs,
        questionnaireAssertions,
        queryUnits,
        answerRows,
        selectedOptions,
      },
      "2",
    );
  }
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
    abortSignal: input.abortSignal,
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
  runIds?: string[];
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
    publishedReleaseQa: input.publishedReleaseQa,
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
      !isActionPlanGenerationJobKind(job.kind) ||
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
      const runIds = input.runIds ?? [input.runId];
      const runs = await tx.query.aiProcessingRuns.findMany({
        columns: {
          id: true,
          organizationId: true,
          assessmentRevisionId: true,
          operationKind: true,
          status: true,
          jobId: true,
        },
        where: {
          RAW: (table) => inArray(table.id, runIds),
        },
      });
      if (
        runs.length !== runIds.length ||
        runs.some(
          (run) =>
            run.organizationId !== input.organizationId ||
            run.assessmentRevisionId !== snapshot.assessmentRevisionId ||
            run.operationKind !== "action_plan_generation" ||
            run.status !== "processing" ||
            run.jobId !== input.jobId,
        )
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
            inArray(aiProcessingRuns.id, input.runIds ?? [input.runId]),
            eq(aiProcessingRuns.status, "processing"),
          ),
        );
    }
    await tx
      .update(aiProcessingRuns)
      .set({
        status: "failed",
        errorCode: "GENERATION_CANDIDATE_REJECTED",
        errorMessage:
          "A corrected category candidate replaced this generation attempt.",
        completedAt: approvedAt,
      })
      .where(
        and(
          eq(aiProcessingRuns.jobId, input.jobId),
          eq(aiProcessingRuns.status, "processing"),
        ),
      );
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
    const processingRun = await tx.query.aiProcessingRuns.findFirst({
      columns: { id: true },
      where: {
        RAW: (table, operators) =>
          and(eq(table.jobId, input.jobId), eq(table.status, "processing")) ??
          operators.sql`true`,
      },
    });
    if (processingRun) {
      throw new Error("Action Plan success cannot leave a processing AI run");
    }
    const [completedJob] = await tx
      .update(backgroundJobs)
      .set({
        state: "succeeded",
        progress: 100,
        safeErrorCode: null,
        safeErrorMessage: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        finishedAt: approvedAt,
        updatedAt: approvedAt,
      })
      .where(
        and(
          eq(backgroundJobs.id, input.jobId),
          eq(backgroundJobs.state, "running"),
        ),
      )
      .returning({ id: backgroundJobs.id });
    if (!completedJob) {
      throw new Error("Action Plan generation job no longer owns persistence");
    }
    await tx.insert(backgroundJobResults).values({
      jobId: completedJob.id,
      actionPlanId: plan.id,
    });
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
  abortSignal?: AbortSignal;
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
    abortSignal: input.abortSignal,
    publishedReleaseQa: input.publishedReleaseQa,
  });
  const plan = await activateGeneratedActionPlan({
    userId: input.userId,
    organizationId: input.organizationId,
    sourceGapRevisionId: input.sourceGapRevisionId,
    jobId: input.jobId,
    runId: generated.runId,
    runIds: generated.runIds,
    content: generated.content,
    publishedReleaseQa: input.publishedReleaseQa,
  });
  return { type: "action_plan", id: plan.id };
}

async function generateActionPlanCategoriesVersioned(
  input: {
    input: Parameters<typeof generateActionPlanContent>[0];
    snapshot: Awaited<ReturnType<typeof loadSourceSnapshot>>;
    categoryInputs: Array<{
      finding: {
        id: string;
        severity: "low" | "medium" | "high" | "critical";
      };
      requirement: {
        code: string;
      };
      gaps: Array<{
        key: string;
        row: {
          kind: "missing" | "partial" | "uncertain";
          sourceAssessmentAnswerId: string;
        };
      }>;
    }>;
    questionnaireAssertions: Array<{
      answerId: string;
      queryUnitId: string;
      excerpt: string;
    }>;
    queryUnits: Array<{
      id: string;
      query: string;
      retrievalQuery: string;
      preferredMappedLegalProvisionIds: string[];
      preferredMappedLegalProvisionKeys: string[];
      legalTierLimits: {
        primary_authority: number;
        official_guidance: number;
        curated_secondary: number;
      };
    }>;
    answerRows: Array<{
      id: string;
      questionId: string;
      questionStableKey: string;
    }>;
    selectedOptions: Array<{ answerId: string; stableValue: string }>;
  },
  contractVersion: "2" | "3" | "4" | "5" | "6",
): Promise<{
  runId: string;
  runIds: string[];
  content: ValidatedActionPlanContent;
}> {
  const contextByCategory = new Map<string, GroundingContextItem[]>();
  const runIdsByCategory: Record<string, string> = {};
  const coordinated = await coordinateCategoryGeneration<
    (typeof input.categoryInputs)[number],
    ActionPlanCategoryResponseV2,
    ValidatedActionPlanContent["categories"][number]
  >({
    signal: input.input.abortSignal ?? new AbortController().signal,
    concurrency: actionPlanGenerationConcurrency(),
    tasks: input.categoryInputs.map((category) => ({
      categoryCode: category.requirement.code,
      taskId: contentHash({
        operation: "action_plan_generation",
        sourceGapRevisionId: input.input.sourceGapRevisionId,
        releaseId: input.snapshot.release.id,
        contract:
          contractVersion === "6"
            ? ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION
            : contractVersion === "5"
              ? ACTION_PLAN_RESPONSE_SCHEMA_V5_VERSION
              : contractVersion === "4"
                ? ACTION_PLAN_RESPONSE_SCHEMA_V4_VERSION
                : ACTION_PLAN_RESPONSE_SCHEMA_V2_VERSION,
        locale: input.input.outputLocale,
        categoryCode: category.requirement.code,
        generationReservation: input.input.jobId,
      }),
      input: category,
    })),
    async generate({
      task,
      phase,
      rejectedCandidate,
      issues,
      signal,
      providerAttempt,
    }) {
      const queryUnit = input.queryUnits.find(
        (candidate) => candidate.id === task.categoryCode,
      );
      if (!queryUnit) throw new Error("Action Plan category query is missing");
      let responsePolicy:
        | ActionPlanCategoryPolicyV2
        | ActionPlanCategoryPolicyV3
        | ActionPlanCategoryPolicyV4
        | ActionPlanCategoryPolicyV5
        | ActionPlanCategoryPolicyV6
        | undefined;
      const grounded = await runGroundedOperation<ActionPlanCategoryResponseV2>(
        {
          operation: "gap_analysis",
          runOperationKind: "action_plan_generation",
          actor: input.input.actor,
          organizationId: input.input.organizationId,
          outputLocale: input.input.outputLocale,
          workflowReleaseId: input.snapshot.release.id,
          asOfDate: new Date().toISOString().slice(0, 10),
          organizationEvidenceVersionIds: input.snapshot.documentVersionIds,
          questionnaireAssertions: input.questionnaireAssertions.filter(
            (assertion) => assertion.queryUnitId === task.categoryCode,
          ),
          queryUnits: [
            phase === "repair"
              ? {
                  ...queryUnit,
                  query: JSON.stringify({
                    pinnedCategoryInput: JSON.parse(queryUnit.query),
                    rejectedCandidate,
                  }),
                }
              : queryUnit,
          ],
          systemInstruction:
            contractVersion === "6"
              ? phase === "initial"
                ? actionPlanPromptV6(input.input.outputLocale)
                : actionPlanRepairPromptV6({
                    locale: input.input.outputLocale,
                    categoryCode: task.categoryCode,
                    issues: issues ?? [],
                  })
              : contractVersion === "5"
                ? phase === "initial"
                  ? actionPlanPromptV5(input.input.outputLocale)
                  : actionPlanRepairPromptV5({
                      locale: input.input.outputLocale,
                      categoryCode: task.categoryCode,
                      issues: issues ?? [],
                    })
                : contractVersion === "4"
                  ? phase === "initial"
                    ? actionPlanPromptV4(input.input.outputLocale)
                    : actionPlanRepairPromptV4({
                        locale: input.input.outputLocale,
                        categoryCode: task.categoryCode,
                        issues: issues ?? [],
                      })
                  : contractVersion === "3"
                    ? phase === "initial"
                      ? actionPlanPromptV3(input.input.outputLocale)
                      : actionPlanRepairPromptV3({
                          locale: input.input.outputLocale,
                          categoryCode: task.categoryCode,
                          issues: issues ?? [],
                        })
                    : phase === "initial"
                      ? actionPlanPromptV2(input.input.outputLocale)
                      : actionPlanRepairPromptV2({
                          locale: input.input.outputLocale,
                          categoryCode: task.categoryCode,
                          issues: issues ?? [],
                        }),
          outputContract: {
            schema(context) {
              const policy = actionPlanV2Policy(
                task.input,
                context,
                input.input.outputLocale,
              );
              responsePolicy = policy;
              return contractVersion === "6"
                ? buildActionPlanCategoryResponseSchemaV6(policy)
                : contractVersion === "5"
                  ? buildActionPlanCategoryResponseSchemaV5(policy)
                  : contractVersion === "4"
                    ? buildActionPlanCategoryResponseSchemaV4(policy)
                    : contractVersion === "3"
                      ? buildActionPlanCategoryResponseSchemaV3(policy)
                      : buildActionPlanCategoryResponseSchemaV2(policy);
            },
            languagePolicy: "localized",
            generatedProse(value) {
              return value.actions.flatMap((action) =>
                action.mode === "remediation"
                  ? [action.title, action.result, ...action.suggestedEvidence]
                  : [
                      action.verificationTitle,
                      action.verificationResult,
                      ...(action.conditionalRemediation
                        ? [action.conditionalRemediation]
                        : []),
                      ...action.suggestedEvidence,
                    ],
              );
            },
            claims(value) {
              const policy =
                responsePolicy ??
                actionPlanV2Policy(
                  task.input,
                  contextByCategory.get(task.categoryCode) ?? [],
                  input.input.outputLocale,
                );
              return value.actions.map((action, index) => ({
                key: `action-plan:${task.categoryCode}:${index + 1}`,
                queryUnitId: task.categoryCode,
                kind: "legal" as const,
                binding: true,
                citationIds: [
                  ...new Set([
                    ...action.gapKeys.flatMap(
                      (key) => policy.mandatoryCitationIdsByGapKey[key] ?? [],
                    ),
                    ...action.supportingOrganizationCitationIds,
                  ]),
                ],
                text:
                  action.mode === "remediation"
                    ? `${action.title}. ${action.result}`
                    : `${action.verificationTitle}. ${action.verificationResult}`,
              }));
            },
          },
          idempotencyKey: contentHash({
            taskId: task.taskId,
            phase,
            providerAttempt,
          }),
          assessmentRevisionId: input.snapshot.assessmentRevisionId,
          jobId: input.input.jobId,
          abortSignal: signal,
          promptMetadata: {
            name:
              contractVersion === "6"
                ? ACTION_PLAN_PROMPT_V6_NAME
                : contractVersion === "5"
                  ? ACTION_PLAN_PROMPT_V5_NAME
                  : contractVersion === "4"
                    ? ACTION_PLAN_PROMPT_V4_NAME
                    : contractVersion === "3"
                      ? ACTION_PLAN_PROMPT_V3_NAME
                      : ACTION_PLAN_PROMPT_V2_NAME,
            version:
              contractVersion === "6"
                ? ACTION_PLAN_PROMPT_V6_VERSION
                : contractVersion === "5"
                  ? ACTION_PLAN_PROMPT_V5_VERSION
                  : contractVersion === "4"
                    ? ACTION_PLAN_PROMPT_V4_VERSION
                    : contractVersion === "3"
                      ? ACTION_PLAN_PROMPT_V3_VERSION
                      : ACTION_PLAN_PROMPT_V2_VERSION,
            templateHash:
              contractVersion === "6"
                ? ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH
                : contractVersion === "5"
                  ? ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH
                  : contractVersion === "4"
                    ? ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH
                    : contractVersion === "3"
                      ? ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH
                      : ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH,
            responseSchemaVersion:
              contractVersion === "6"
                ? ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION
                : contractVersion === "5"
                  ? ACTION_PLAN_RESPONSE_SCHEMA_V5_VERSION
                  : contractVersion === "4"
                    ? ACTION_PLAN_RESPONSE_SCHEMA_V4_VERSION
                    : contractVersion === "3"
                      ? ACTION_PLAN_RESPONSE_SCHEMA_V3_VERSION
                      : ACTION_PLAN_RESPONSE_SCHEMA_V2_VERSION,
          },
        },
      );
      contextByCategory.set(task.categoryCode, grounded.context);
      runIdsByCategory[task.categoryCode] = grounded.runId;
      await db.insert(auditEvents).values({
        organizationId: input.input.organizationId,
        actorUserId: input.input.actor.userId,
        eventType: "ai_generation.category_run",
        entityType: "ai_processing_run",
        entityId: grounded.runId,
        metadata: {
          categoryCode: task.categoryCode,
          phase,
          providerAttempt,
          recovered: grounded.recovered === true,
        },
      });
      return grounded.output;
    },
    validate(candidate, task) {
      try {
        const policy = actionPlanV2Policy(
          task.input,
          contextByCategory.get(task.categoryCode) ?? [],
          input.input.outputLocale,
        );
        const normalized =
          contractVersion === "6"
            ? normalizeActionPlanCategoryResponseV6({
                value: candidate,
                policy,
              })
            : contractVersion === "5"
              ? normalizeActionPlanCategoryResponseV5({
                  value: candidate,
                  policy,
                })
              : contractVersion === "4"
                ? normalizeActionPlanCategoryResponseV4({
                    value: candidate,
                    policy,
                  })
                : contractVersion === "3"
                  ? normalizeActionPlanCategoryResponseV3({
                      value: candidate,
                      policy,
                    })
                  : normalizeActionPlanCategoryResponseV2({
                      value: candidate,
                      policy,
                    });
        return {
          valid: true,
          value: normalized.value,
          normalizedIssueCodes: normalized.normalizationCodes,
        };
      } catch (error) {
        return {
          valid: false,
          failureClass: "repairable_content",
          issues:
            error &&
            typeof error === "object" &&
            "issues" in error &&
            Array.isArray(error.issues)
              ? safeGenerationIssues(error.issues)
              : [{ code: "content_invalid", path: [] }],
        };
      }
    },
    async onDiagnostic(diagnostic) {
      await db.insert(auditEvents).values({
        organizationId: input.input.organizationId,
        actorUserId: input.input.actor.userId,
        eventType: "ai_generation.category_diagnostic",
        entityType: "background_job",
        entityId: input.input.jobId,
        metadata: diagnostic,
      });
    },
  });
  const runIds = input.categoryInputs.map(
    (category) => runIdsByCategory[category.requirement.code]!,
  );
  if (runIds.some((runId) => !runId)) {
    throw new Error("Action Plan category run coverage is incomplete");
  }
  await Promise.all([
    db
      .insert(aiProcessingRunAssessmentInputs)
      .values(
        runIds.map((runId) => ({
          runId,
          assessmentRevisionId: input.snapshot.assessmentRevisionId,
          sourceHash: contentHash({
            answers: input.answerRows,
            options: input.selectedOptions,
          }),
        })),
      )
      .onConflictDoNothing(),
    input.snapshot.documentVersions.length
      ? db
          .insert(aiProcessingRunDocumentInputs)
          .values(
            runIds.flatMap((runId) =>
              input.snapshot.documentVersions.map((documentVersion) => ({
                runId,
                documentVersionId: documentVersion.id,
                sourceHash: documentVersion.contentHash,
              })),
            ),
          )
          .onConflictDoNothing()
      : Promise.resolve(),
  ]);
  return {
    runId: runIds[0]!,
    runIds,
    content: { categories: coordinated.categories },
  };
}

function actionPlanV2Policy(
  category: {
    finding: {
      id: string;
      severity: "low" | "medium" | "high" | "critical";
    };
    requirement: { code: string };
    gaps: Array<{
      key: string;
      row: {
        kind: "missing" | "partial" | "uncertain";
        sourceAssessmentAnswerId: string;
      };
    }>;
  },
  context: GroundingContextItem[],
  outputLocale: "de" | "en",
): ActionPlanCategoryPolicyV2 {
  const supplied = context.filter(
    (item) => item.queryUnitId === category.requirement.code,
  );
  const legal = supplied.find(
    (item) =>
      item.channel === "legal" &&
      item.metadata.selectionRole === "mapped_primary",
  );
  if (!legal) throw new Error("Action Plan primary legal citation is missing");
  return {
    requirementCode: category.requirement.code,
    sourceFindingId: category.finding.id,
    priority: category.finding.severity,
    outputLocale,
    gaps: category.gaps.map((gap) => ({
      key: gap.key,
      kind: gap.row.kind,
    })),
    admittedOrganizationCitationIds: supplied
      .filter((item) => item.channel === "organization_document")
      .map((item) => item.citationId),
    mandatoryCitationIdsByGapKey: Object.fromEntries(
      category.gaps.map((gap) => {
        const questionnaire = supplied.find(
          (item) =>
            item.channel === "questionnaire_assertion" &&
            item.sourceId === gap.row.sourceAssessmentAnswerId,
        );
        if (!questionnaire) {
          throw new Error("Action Plan questionnaire citation is missing");
        }
        return [gap.key, [questionnaire.citationId, legal.citationId]];
      }),
    ),
  };
}

function actionPlanGenerationConcurrency() {
  const value = Number(process.env.AI_CATEGORY_CONCURRENCY ?? 3);
  return Number.isFinite(value) ? Math.max(1, Math.min(3, value)) : 3;
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
  publishedReleaseQa?: true;
}) {
  const staleness = await getGapRevisionStaleness({
    userId: input.userId,
    organizationId: input.organizationId,
    revisionId: input.sourceGapRevisionId,
  });
  if (
    staleness.stale ||
    (staleness.outdatedRelease && !input.publishedReleaseQa) ||
    staleness.archived
  ) {
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
  const v6 =
    release.actionPlanPrompt.name === ACTION_PLAN_PROMPT_V6_NAME &&
    release.actionPlanPrompt.version === ACTION_PLAN_PROMPT_V6_VERSION &&
    release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH &&
    release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION;
  const v5 =
    release.actionPlanPrompt.name === ACTION_PLAN_PROMPT_V5_NAME &&
    release.actionPlanPrompt.version === ACTION_PLAN_PROMPT_V5_VERSION &&
    release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH &&
    release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V5_VERSION;
  const v4 =
    release.actionPlanPrompt.name === ACTION_PLAN_PROMPT_V4_NAME &&
    release.actionPlanPrompt.version === ACTION_PLAN_PROMPT_V4_VERSION &&
    release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH &&
    release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V4_VERSION;
  const v3 =
    release.actionPlanPrompt.name === ACTION_PLAN_PROMPT_V3_NAME &&
    release.actionPlanPrompt.version === ACTION_PLAN_PROMPT_V3_VERSION &&
    release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH &&
    release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V3_VERSION;
  const v2 =
    release.actionPlanPrompt.name === ACTION_PLAN_PROMPT_V2_NAME &&
    release.actionPlanPrompt.version === ACTION_PLAN_PROMPT_V2_VERSION &&
    release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH &&
    release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_V2_VERSION;
  const v1 =
    release.actionPlanPrompt.name === ACTION_PLAN_PROMPT_NAME &&
    release.actionPlanPrompt.version === ACTION_PLAN_PROMPT_VERSION &&
    release.actionPlanPrompt.templateHash ===
      ACTION_PLAN_PROMPT_TEMPLATE_HASH &&
    release.actionPlanPrompt.responseSchemaVersion ===
      ACTION_PLAN_RESPONSE_SCHEMA_VERSION;
  if (!v1 && !v2 && !v3 && !v4 && !v5 && !v6) {
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
