import { createHash } from "node:crypto";
import { db } from "@/src/db";
import {
  actionPlanItemGaps,
  actionPlanItems,
  actionPlans,
  aiProcessingRuns,
  analysisOutputDocumentSources,
  assessmentAnswers,
  auditEvents,
  backgroundJobs,
  gapFindings,
  gapItems,
} from "@/src/db/schema";
import {
  currentGapDefinitionHash,
  getCurrentGapDefinition,
} from "@/src/server/definitions";
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { withAuthorizedOrganizationCommand } from "../auth/organization-scope";
import { enqueueJob } from "../jobs";
import { getCurrentActionPlan } from "./service";
import {
  prepareGroundingOperation,
  runGroundedOperation,
} from "../ai/grounding/gateway";
import type { GroundingContextItem } from "../ai/grounding/types";
import {
  CURRENT_ACTION_PLAN_PROMPT_METADATA,
  actionPlanDefinitionHash,
  actionPlanPrompt as actionPlanPromptV6,
  actionPlanRepairPrompt as actionPlanRepairPromptV6,
  buildActionPlanCategoryResponseSchema as buildActionPlanCategoryResponseSchemaV6,
  normalizeActionPlanCategoryResponse as normalizeActionPlanCategoryResponseV6,
  type ActionPlanCategoryPolicy as ActionPlanCategoryPolicyV6,
  type ActionPlanCategoryResponse as ActionPlanCategoryResponseV6,
} from "./current-contract";
import { buildActionPlanCategoryQuery } from "./prompt-contract";
import {
  coordinateCategoryGeneration,
  generationCallAttemptIdentity,
  generationReservationIdentity,
  parseDurableExecutionAttempt,
  safeGenerationIssues,
} from "../ai/generation";
import { configuredCategoryConcurrency } from "../ai/generation/concurrency";
import { assertLiveParentJobForAiRun } from "../ai/generation/job-run-lifecycle";
import { serializeActionDescription } from "./action-description";
import { assertActionPlanPublicationLease } from "./publication-lease-policy";

const BUILD_HASH = process.env.APP_BUILD_SHA ?? currentGapDefinitionHash;

export async function enqueueActionPlanGeneration(input: {
  userId: string;
  organizationId: string;
  sourceGapRevisionId: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "plans:manage" }, async ({ executor: db }) => {
  if (
    await db.query.actionPlans.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.organizationId, input.organizationId) ??
          operators.sql`true`,
      },
    })
  ) {
    throw new ApiError(
      409,
      "This organization already has its one Action Plan",
      undefined,
      "ACTION_PLAN_ALREADY_EXISTS",
    );
  }
  const output = await db.query.analysisOutputs.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, input.organizationId),
          eq(table.kind, "gap"),
        ) ?? operators.sql`true`,
    },
  });
  if (output?.currentRevisionId !== input.sourceGapRevisionId) {
    throw new ApiError(
      409,
      "Action Plan generation requires the current Gap revision",
    );
  }
  const blockers = await db
    .select({ id: gapFindings.id })
    .from(gapFindings)
    .where(
      and(
        eq(gapFindings.outputRevisionId, input.sourceGapRevisionId),
        eq(gapFindings.materialContradiction, true),
        eq(gapFindings.contradictionResolved, false),
      ),
    );
  if (blockers.length) {
    throw new ApiError(
      409,
      "Resolve material contradictions before creating the Action Plan",
      { findingIds: blockers.map((item) => item.id) },
      "ACTION_PLAN_CONTRADICTION_BLOCKED",
    );
  }
  const revision = await db.query.analysisOutputRevisions.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, input.sourceGapRevisionId),
          eq(table.organizationId, input.organizationId),
        ) ?? operators.sql`true`,
    },
  });
  if (!revision) throw new ApiError(404, "Gap revision not found");
  if (revision.definitionHash !== currentGapDefinitionHash) {
    throw new ApiError(
      409,
      "The current Gap result uses an outdated definition",
      undefined,
      "GAP_DEFINITION_CHANGED",
    );
  }
  return enqueueJob({
    organizationId: input.organizationId,
    requestedByUserId: input.userId,
    kind: "action_plan_generation",
    payload: {
      sourceGapRevisionId: revision.id,
      locale: revision.locale as "de" | "en",
      gapDefinitionHash: revision.definitionHash,
      actionPlanDefinitionHash,
      buildHash: BUILD_HASH,
    },
  }, { executor: db });
  });
}

export async function executeActionPlanGenerationJob(input: {
  jobId: string;
  organizationId: string;
  userId: string;
  workerId: string;
  sourceGapRevisionId: string;
  locale: "de" | "en";
  attemptCount: number;
  abortSignal?: AbortSignal;
  groundingDependencies?: import("../ai/grounding/gateway").GroundingExecutionDependencies;
}) {
  if (input.abortSignal?.aborted) throw input.abortSignal.reason;
  const durableExecutionAttempt = parseDurableExecutionAttempt(
    input.attemptCount,
  );
  await assertLiveParentJobForAiRun({
    jobId: input.jobId,
    organizationId: input.organizationId,
    expectedLeaseOwner: input.workerId,
  });
  const existing = await db.query.actionPlans.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, input.organizationId) ?? operators.sql`true`,
    },
  });
  if (existing) {
    if (existing.generationJobId !== input.jobId) {
      throw new ApiError(
        409,
        "This organization already has its one Action Plan",
        { actionPlanId: existing.id },
        "ACTION_PLAN_ALREADY_EXISTS",
      );
    }
    if (
      !(await hasCompletePublishedPlan({
        actionPlanId: existing.id,
        sourceGapRevisionId: input.sourceGapRevisionId,
      }))
    ) {
      throw new ApiError(
        409,
        "The Action Plan publication is incomplete and requires operator repair",
        { actionPlanId: existing.id, generationJobId: input.jobId },
        "ACTION_PLAN_PARTIAL_STATE",
      );
    }
    return { type: "action_plan", id: existing.id };
  }

  const revision = await db.query.analysisOutputRevisions.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, input.sourceGapRevisionId),
          eq(table.organizationId, input.organizationId),
        ) ?? operators.sql`true`,
    },
  });
  if (!revision || revision.locale !== input.locale) {
    throw new ApiError(
      409,
      "Action Plan inputs do not match the Gap revision",
      undefined,
      "GAP_INPUT_SNAPSHOT_INVALID",
    );
  }
  if (revision.definitionHash !== currentGapDefinitionHash) {
    throw new ApiError(
      409,
      "The source Gap result uses an outdated definition",
      undefined,
      "GAP_DEFINITION_CHANGED",
    );
  }
  const definition = getCurrentGapDefinition(input.locale);
  const findings = await db
    .select()
    .from(gapFindings)
    .where(eq(gapFindings.outputRevisionId, input.sourceGapRevisionId))
    .orderBy(asc(gapFindings.position));
  const actionable = findings.filter((finding) => finding.status !== "fulfilled");
  const gaps = actionable.length
    ? await db
        .select()
        .from(gapItems)
        .where(inArray(gapItems.findingId, actionable.map((finding) => finding.id)))
        .orderBy(asc(gapItems.position))
    : [];
  const selectedVersions = await db
    .select({ documentVersionId: analysisOutputDocumentSources.documentVersionId })
    .from(analysisOutputDocumentSources)
    .where(eq(analysisOutputDocumentSources.outputRevisionId, revision.id))
    .orderBy(asc(analysisOutputDocumentSources.position));
  const answers = await db
    .select()
    .from(assessmentAnswers)
    .where(eq(assessmentAnswers.assessmentRevisionId, revision.assessmentRevisionId))
    .orderBy(asc(assessmentAnswers.position));

  const categoryInputs = actionable.flatMap((finding) => {
    const requirement = definition.requirements.find(
      (candidate) => candidate.stableRequirementId === finding.requirementKey,
    );
    if (!requirement) {
      throw new ApiError(
        409,
        "A pinned Action Plan requirement is unavailable",
        undefined,
        "GAP_INPUT_SNAPSHOT_INVALID",
      );
    }
    const categoryGaps = gaps
      .filter((gap) => gap.findingId === finding.id)
      .map((gap, position) => ({
        key: `G${position + 1}`,
        row: gap,
        sourceAssessmentAnswerId: findSourceAnswerId(
          gap.stableKey,
          requirement.questionStableKeys,
          answers,
        ),
      }));
    return categoryGaps.length ? [{ finding, requirement, gaps: categoryGaps }] : [];
  });
  if (!categoryInputs.length) {
    throw new ApiError(
      409,
      "The Gap result contains no atomic gaps for Action Plan generation",
      undefined,
      "ACTION_PLAN_NO_GAPS",
    );
  }

  const preparedGrounding = await prepareGroundingOperation(
    {
      operation: "gap_analysis",
      organizationId: input.organizationId,
      workflowReleaseId: currentGapDefinitionHash,
    },
    input.groundingDependencies,
  );
  const contextByCategory = new Map<string, GroundingContextItem[]>();
  const runIdsByCategory: Record<string, string> = {};
  const coordinated = await coordinateCategoryGeneration<
    (typeof categoryInputs)[number],
    ActionPlanCategoryResponseV6,
    {
      requirementCode: string;
      sourceFindingId: string;
      actions: Array<{
        title: string;
        result: string;
        suggestedEvidence: string[];
        priority: "low" | "medium" | "high" | "critical";
        position: number;
        gapKeys: string[];
        citationIds: string[];
      }>;
    }
  >({
    signal: input.abortSignal ?? new AbortController().signal,
    concurrency: configuredCategoryConcurrency(),
    tasks: categoryInputs.map((category) => ({
      categoryCode: category.requirement.code,
      taskId: hash({
        operation: "action_plan_generation",
        generationJobId: input.jobId,
        sourceGapRevisionId: input.sourceGapRevisionId,
        categoryCode: category.requirement.code,
        locale: input.locale,
        definitionHash: actionPlanDefinitionHash,
        contract: CURRENT_ACTION_PLAN_PROMPT_METADATA.responseSchemaVersion,
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
      const category = task.input;
      const reservationIdentity = generationReservationIdentity({
        taskId: task.taskId,
        phase,
      });
      const callAttemptIdentity = generationCallAttemptIdentity({
        reservationIdentity,
        durableExecutionAttempt,
        providerAttempt,
      });
      const questions = category.requirement.questionStableKeys.map((stableKey) => {
        const question = definition.questions.find((item) => item.stableKey === stableKey);
        const answer = answers.find((item) => item.questionKey === stableKey);
        return {
          question: question?.questionText ?? stableKey,
          answer: typeof answer?.answerValue === "string" ? answer.answerValue : "missing",
          satisfied: answer?.answerValue === "fully_implemented",
        };
      });
      const mappedProvisions = category.requirement.questionStableKeys.flatMap(
        (stableKey) =>
          definition.questions.find((question) => question.stableKey === stableKey)
            ?.legalProvisions ?? [],
      );
      const baseQuery = buildActionPlanCategoryQuery({
        requirement: category.requirement,
        gaps: category.gaps.map((gap) => ({
          key: gap.key,
          kind: gap.row.kind,
          statement: gap.row.statement,
        })),
        questionsAndAnswers: questions,
      });
      const queryUnit = {
        id: category.requirement.code,
        query:
          phase === "repair"
            ? JSON.stringify({
                pinnedCategoryInput: JSON.parse(baseQuery),
                rejectedCandidate,
              })
            : baseQuery,
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
      let responsePolicy: ActionPlanCategoryPolicyV6 | undefined;
      const grounded = await runGroundedOperation<ActionPlanCategoryResponseV6>({
        operation: "gap_analysis",
        runOperationKind: "action_plan_generation",
        actor: { userId: input.userId },
        organizationId: input.organizationId,
        outputLocale: input.locale,
        workflowReleaseId: currentGapDefinitionHash,
        asOfDate: new Date().toISOString().slice(0, 10),
        organizationEvidenceVersionIds: selectedVersions.map(
          (item) => item.documentVersionId,
        ),
        questionnaireAssertions: category.gaps.map((gap) => {
          const answer = answers.find(
            (candidate) => candidate.id === gap.sourceAssessmentAnswerId,
          )!;
          return {
            answerId: answer.id,
            queryUnitId: category.requirement.code,
            excerpt: `${answer.questionText}: ${answer.selectedOptionLabels.join(", ") || String(answer.answerValue)}`,
          };
        }),
        queryUnits: [queryUnit],
        systemInstruction:
          phase === "initial"
            ? actionPlanPromptV6(input.locale)
            : actionPlanRepairPromptV6({
                locale: input.locale,
                categoryCode: category.requirement.code,
                issues: issues ?? [],
              }),
        outputContract: {
          schema(context) {
            responsePolicy = actionPlanPolicy(category, context, input.locale);
            return buildActionPlanCategoryResponseSchemaV6(responsePolicy);
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
              responsePolicy ?? actionPlanPolicy(category, contextByCategory.get(task.categoryCode) ?? [], input.locale);
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
        idempotencyKey: callAttemptIdentity,
        generationReservationKey: reservationIdentity,
        generationAttemptKey: callAttemptIdentity,
        durableExecutionAttempt,
        providerAttempt,
        assessmentRevisionId: revision.assessmentRevisionId,
        jobId: input.jobId,
        expectedLeaseOwner: input.workerId,
        definitionHash: actionPlanDefinitionHash,
        abortSignal: signal,
        promptMetadata: {
          ...CURRENT_ACTION_PLAN_PROMPT_METADATA,
        },
        preparedGrounding,
      }, input.groundingDependencies);
      contextByCategory.set(task.categoryCode, grounded.context);
      runIdsByCategory[task.categoryCode] = grounded.runId;
      return grounded.output;
    },
    validate(candidate, task) {
      try {
        const normalized = normalizeActionPlanCategoryResponseV6({
          value: candidate,
          policy: actionPlanPolicy(
            task.input,
            contextByCategory.get(task.categoryCode) ?? [],
            input.locale,
          ),
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
  });
  const runIds = categoryInputs.map(
    (category) => runIdsByCategory[category.requirement.code]!,
  );
  if (runIds.some((runId) => !runId)) {
    throw new Error("Action Plan grounded run coverage is incomplete");
  }
  const manifest = {
    sourceGapRevisionId: input.sourceGapRevisionId,
    findingIds: categoryInputs.map((item) => item.finding.id),
    gapIds: gaps.map((item) => item.id),
  };
  const now = new Date();
  const planId = await db.transaction(async (tx) => {
    const [job] = await tx
      .select({
        state: backgroundJobs.state,
        leaseOwner: backgroundJobs.leaseOwner,
        leaseExpiresAt: backgroundJobs.leaseExpiresAt,
        cancellationRequestedAt: backgroundJobs.cancellationRequestedAt,
      })
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, input.jobId))
      .limit(1)
      .for("update");
    assertActionPlanPublicationLease(job, { workerId: input.workerId, now });
    const output = await tx.query.analysisOutputs.findFirst({
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.organizationId, input.organizationId),
            eq(table.kind, "gap"),
          ) ?? operators.sql`true`,
      },
    });
    if (output?.currentRevisionId !== input.sourceGapRevisionId) {
      throw new ApiError(
        409,
        "Only the current Gap result can create an Action Plan",
        undefined,
        "GAP_REVISION_NOT_CURRENT",
      );
    }
    const source = await tx.query.analysisOutputRevisions.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.id, input.sourceGapRevisionId) ?? operators.sql`true`,
      },
    });
    if (!source || source.definitionHash !== currentGapDefinitionHash) {
      throw new ApiError(
        409,
        "The source Gap result is outdated",
        undefined,
        "GAP_DEFINITION_CHANGED",
      );
    }
    const anyPlan = await tx.query.actionPlans.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.organizationId, input.organizationId) ?? operators.sql`true`,
      },
    });
    if (anyPlan) {
      if (anyPlan.generationJobId === input.jobId) return anyPlan.id;
      throw new ApiError(
        409,
        "This organization already has its one Action Plan",
        { actionPlanId: anyPlan.id },
        "ACTION_PLAN_ALREADY_EXISTS",
      );
    }
    const [plan] = await tx
      .insert(actionPlans)
      .values({
        organizationId: input.organizationId,
        sourceGapRevisionId: input.sourceGapRevisionId,
        generationJobId: input.jobId,
        aiProcessingRunId: runIds[0],
        locale: input.locale,
        inputHash: hash(manifest),
        createdBy: input.userId,
      })
      .returning();
    if (!plan) throw new Error("Action Plan was not created");
    const gapByKey = new Map(
      categoryInputs.flatMap((category) =>
        category.gaps.map((gap) => [
          `${category.finding.id}:${gap.key}`,
          gap.row,
        ] as const),
      ),
    );
    let position = 0;
    for (const category of coordinated.categories) {
      for (const action of category.actions) {
        const [stored] = await tx
          .insert(actionPlanItems)
          .values({
            organizationId: input.organizationId,
            actionPlanId: plan.id,
            findingId: category.sourceFindingId,
            title: action.title,
            description: serializeActionDescription(
              action.result,
              action.suggestedEvidence,
              input.locale,
            ),
            position,
          })
          .returning();
        if (!stored) throw new Error("Generated Action Plan item was not stored");
        position += 1;
        await tx.insert(actionPlanItemGaps).values(
          action.gapKeys.map((gapKey) => ({
            organizationId: input.organizationId,
            actionPlanId: plan.id,
            actionPlanItemId: stored.id,
            gapItemId: requireMapValue(
              gapByKey,
              `${category.sourceFindingId}:${gapKey}`,
            ).id,
          })),
        );
      }
    }
    const completed = await tx
      .update(aiProcessingRuns)
      .set({
        status: "succeeded",
        completedAt: now,
        failureCode: null,
        failureMessage: null,
      })
      .where(
        and(
          inArray(aiProcessingRuns.id, runIds),
          eq(aiProcessingRuns.status, "processing"),
        ),
      )
      .returning({ id: aiProcessingRuns.id });
    if (completed.length !== runIds.length) {
      throw new Error("Grounded Action Plan run publication is incomplete");
    }
    await tx
      .update(aiProcessingRuns)
      .set({
        status: "failed",
        failureCode: "GENERATION_ATTEMPT_SUPERSEDED",
        failureMessage:
          "A selected attempt superseded this generation candidate.",
        completedAt: now,
      })
      .where(
        and(
          eq(aiProcessingRuns.jobId, input.jobId),
          eq(aiProcessingRuns.status, "processing"),
          notInArray(aiProcessingRuns.id, runIds),
        ),
      );
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "action_plan.created",
      entityType: "action_plan",
      entityId: plan.id,
      metadata: {
        sourceGapRevisionId: input.sourceGapRevisionId,
        groundedRunIds: runIds,
        itemCount: position,
      },
    });
    return plan.id;
  });
  return { type: "action_plan", id: planId };
}

export async function activateGeneratedActionPlan(input: {
  userId: string;
  organizationId: string;
}) {
  return getCurrentActionPlan(input.userId, input.organizationId);
}

function actionPlanPolicy(
  category: {
    finding: { id: string; criticality: string };
    requirement: { code: string };
    gaps: Array<{
      key: string;
      row: { kind: "missing" | "partial" | "uncertain" };
      sourceAssessmentAnswerId: string;
    }>;
  },
  context: GroundingContextItem[],
  outputLocale: "de" | "en",
): ActionPlanCategoryPolicyV6 {
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
    priority: isPriority(category.finding.criticality)
      ? category.finding.criticality
      : "medium",
    outputLocale,
    gaps: category.gaps.map((gap) => ({ key: gap.key, kind: gap.row.kind })),
    admittedOrganizationCitationIds: supplied
      .filter((item) => item.channel === "organization_document")
      .map((item) => item.citationId),
    mandatoryCitationIdsByGapKey: Object.fromEntries(
      category.gaps.map((gap) => {
        const questionnaire = supplied.find(
          (item) =>
            item.channel === "questionnaire_assertion" &&
            item.sourceId === gap.sourceAssessmentAnswerId,
        );
        if (!questionnaire) {
          throw new Error("Action Plan questionnaire citation is missing");
        }
        return [gap.key, [questionnaire.citationId, legal.citationId]];
      }),
    ),
  };
}

function findSourceAnswerId(
  gapStableKey: string,
  questionKeys: string[],
  answers: Array<typeof assessmentAnswers.$inferSelect>,
) {
  const questionKey = [...questionKeys]
    .sort((left, right) => right.length - left.length)
    .find(
      (candidate) =>
        gapStableKey === candidate || gapStableKey.startsWith(`${candidate}.`),
    );
  const answer = answers.find((candidate) => candidate.questionKey === questionKey);
  if (!answer) {
    throw new ApiError(
      409,
      "An atomic Gap is not traceable to its questionnaire answer",
      undefined,
      "GAP_ANSWER_TRACE_INVALID",
    );
  }
  return answer.id;
}

async function hasCompletePublishedPlan(input: {
  actionPlanId: string;
  sourceGapRevisionId: string;
}) {
  const [items, links, sourceGaps] = await Promise.all([
    db
      .select({ id: actionPlanItems.id })
      .from(actionPlanItems)
      .where(eq(actionPlanItems.actionPlanId, input.actionPlanId)),
    db
      .select({
        actionPlanItemId: actionPlanItemGaps.actionPlanItemId,
        gapItemId: actionPlanItemGaps.gapItemId,
      })
      .from(actionPlanItemGaps)
      .where(eq(actionPlanItemGaps.actionPlanId, input.actionPlanId)),
    db
      .select({ id: gapItems.id })
      .from(gapItems)
      .where(eq(gapItems.outputRevisionId, input.sourceGapRevisionId)),
  ]);
  if (!items.length || !sourceGaps.length) return false;
  const linkedItemIds = new Set(links.map((link) => link.actionPlanItemId));
  const linkedGapIds = new Set(links.map((link) => link.gapItemId));
  return (
    items.every((item) => linkedItemIds.has(item.id)) &&
    sourceGaps.every((gap) => linkedGapIds.has(gap.id))
  );
}

function isPriority(
  value: string,
): value is "low" | "medium" | "high" | "critical" {
  return ["low", "medium", "high", "critical"].includes(value);
}

function requireMapValue<K, V>(map: Map<K, V>, key: K) {
  const value = map.get(key);
  if (!value) throw new Error(`Required Action Plan mapping is missing: ${String(key)}`);
  return value;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
