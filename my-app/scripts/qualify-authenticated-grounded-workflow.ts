import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  actionPlanItemGaps,
  actionPlanItems,
  aiProcessingRunContext,
  aiProcessingRuns,
  backgroundJobs,
  gapFindingContextLinks,
  gapItemContextLinks,
} from "@/src/db/schema";
import {
  getApplicabilityQuestionnaireForUser,
  submitApplicabilityCheckForUser,
} from "@/src/server/applicability-check";
import {
  enqueueActionPlanGeneration,
  executeActionPlanGenerationJob,
  getCurrentActionPlan,
} from "@/src/server/action-plans";
import { resolvePinnedLegalScope } from "@/src/server/ai/grounding/legal-retrieval";
import { getCurrentGapDefinition } from "@/src/server/definitions";
import {
  createOrOpenGapAssessment,
  enqueueGapAnalysisGeneration,
  executeGapGenerationJob,
  getGapResults,
  saveQuestionnaireDraftAnswer,
  submitGapQuestionnaire,
} from "@/src/server/gap-analysis";
import { succeedJob } from "@/src/server/jobs";
import { createOrganizationForUser } from "@/src/server/organizations/service";
import {
  DETERMINISTIC_APPLICABILITY_ANSWERS,
  deterministicGroundingDependencies,
} from "@/src/server/operator-commands/grounded-workflow-fixture";

const deterministic = process.env.WORKFLOW_QUALIFICATION_DETERMINISTIC === "true";
const userId = process.env.WORKFLOW_QUALIFICATION_USER_ID?.trim() || randomUUID();
const workerId = `grounded-qualification-${randomUUID()}`;
const providerMode = provider();

async function main() {
  const groundingDependencies = deterministic
    ? await deterministicGroundingDependencies(providerMode)
    : undefined;
  await resolvePinnedLegalScope({
    familyCodes: ["nis2-de-primary", "nis2-eu-primary"],
  });
  const organization = await createOrganizationForUser(userId, {
    name: `Grounded workflow qualification ${new Date().toISOString()}`,
    legalName: "Grounded Workflow Qualification GmbH",
    countryCode: "DE",
    aiProviderMode: providerMode,
  });

  const questionnaire = await getApplicabilityQuestionnaireForUser(
    userId,
    organization.id,
    "de",
  );
  const applicability = await submitApplicabilityCheckForUser(
    userId,
    organization.id,
    {
      locale: "de",
      answers: questionnaire.questions.flatMap((question) => {
        const value = DETERMINISTIC_APPLICABILITY_ANSWERS[question.stableKey];
        return value === undefined
          ? []
          : [{ questionId: question.id, value }];
      }),
    },
  );
  if (!applicability.result.outcome.includes("essential")) {
    throw new Error(
      `Qualification applicability outcome is not eligible: ${applicability.result.outcome}`,
    );
  }

  const assessment = await createOrOpenGapAssessment(userId, organization.id);
  const cycle = await db.query.gapAnalysisCycles.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, organization.id),
          eq(table.stage, "questions"),
        ) ?? operators.sql`true`,
    },
  });
  if (!cycle) throw new Error("Qualification Gap cycle was not created");
  const definition = getCurrentGapDefinition("de");
  for (const question of definition.questions) {
    const option = question.options.find(
      (candidate) => candidate.stableValue === "not_implemented",
    );
    if (!option) {
      throw new Error(`No not_implemented option for ${question.stableKey}`);
    }
    await saveQuestionnaireDraftAnswer({
      userId,
      organizationId: organization.id,
      draftId: cycle.id,
      questionId: question.id,
      optionId: option.id,
    });
  }
  await submitGapQuestionnaire({
    userId,
    organizationId: organization.id,
    assessmentId: assessment.id,
    draftId: cycle.id,
  });
  const gapEnqueue = await enqueueGapAnalysisGeneration({
    userId,
    organizationId: organization.id,
    draftId: cycle.id,
    locale: "de",
    idempotencyKey: `qualification-gap-${randomUUID()}`,
  });
  await claimJob(gapEnqueue.job.id);
  const gapResult = await executeGapGenerationJob({
    jobId: gapEnqueue.job.id,
    cycleId: cycle.id,
    userId,
    organizationId: organization.id,
    workerId,
    attemptCount: 1,
    locale: "de",
    groundingDependencies,
  });
  await succeedJob({
    jobId: gapEnqueue.job.id,
    workerId,
    result: gapResult,
  });

  const gap = await getGapResults(
    userId,
    organization.id,
    gapResult.id,
    "de",
  );
  if (!gap) throw new Error("Published Gap result is unavailable");
  const atomicGaps = gap.findings.flatMap((row) => row.finding.gaps);
  if (atomicGaps.length < definition.questions.length) {
    throw new Error(
      `Expected at least ${definition.questions.length} atomic gaps, received ${atomicGaps.length}`,
    );
  }
  assertNoPlaceholder(
    atomicGaps.flatMap((item) => [item.statement, item.recommendation]),
  );

  const actionJob = await enqueueActionPlanGeneration({
    userId,
    organizationId: organization.id,
    sourceGapRevisionId: gapResult.id,
  });
  await claimJob(actionJob.id);
  const actionResult = await executeActionPlanGenerationJob({
    jobId: actionJob.id,
    workerId,
    organizationId: organization.id,
    userId,
    sourceGapRevisionId: gapResult.id,
    attemptCount: 1,
    locale: "de",
    groundingDependencies,
  });
  await succeedJob({ jobId: actionJob.id, workerId, result: actionResult });
  const plan = await getCurrentActionPlan(userId, organization.id);
  if (!plan || plan.items.length < 2) {
    throw new Error("Grounded Action Plan did not produce multiple actions");
  }
  assertNoPlaceholder(
    plan.items.flatMap((item) => [item.title, item.result, ...item.suggestedEvidence]),
  );

  const runs = await db
    .select()
    .from(aiProcessingRuns)
    .where(inArray(aiProcessingRuns.jobId, [gapEnqueue.job.id, actionJob.id]));
  if (
    !runs.length ||
    runs.some(
      (run) =>
        run.status !== "succeeded" ||
        (!deterministic && run.model.startsWith("deterministic-")) ||
        !run.provider ||
        !run.model ||
        run.inputTokens === null ||
        run.outputTokens === null,
    )
  ) {
    throw new Error("AI run provider/model/token provenance is incomplete");
  }
  const runIds = runs.map((run) => run.id);
  const [contexts, findingLinks, gapLinks, actionLinks] = await Promise.all([
    db
      .select()
      .from(aiProcessingRunContext)
      .where(inArray(aiProcessingRunContext.runId, runIds)),
    db
      .select()
      .from(gapFindingContextLinks)
      .where(eq(gapFindingContextLinks.organizationId, organization.id)),
    db
      .select()
      .from(gapItemContextLinks)
      .where(eq(gapItemContextLinks.organizationId, organization.id)),
    db
      .select({ gapItemId: actionPlanItemGaps.gapItemId })
      .from(actionPlanItemGaps)
      .innerJoin(
        actionPlanItems,
        eq(actionPlanItems.id, actionPlanItemGaps.actionPlanItemId),
      )
      .where(eq(actionPlanItems.actionPlanId, plan.plan.id)),
  ]);
  if (
    !contexts.length ||
    contexts.some((context) => !context.exactText.trim()) ||
    !findingLinks.length ||
    new Set(actionLinks.map((link) => link.gapItemId)).size !== atomicGaps.length
  ) {
    throw new Error("Persisted exact context or generated coverage is incomplete");
  }

  console.log(
    JSON.stringify(
      {
        status: "passed",
        organizationId: organization.id,
        applicabilityRevisionId: applicability.outputRevisionId,
        gapRevisionId: gapResult.id,
        actionPlanId: plan.plan.id,
        providerMode,
        deterministic,
        providers: [...new Set(runs.map((run) => run.provider))],
        models: [...new Set(runs.map((run) => run.model))],
        aiRunCount: runs.length,
        exactContextCount: contexts.length,
        findingContextLinkCount: findingLinks.length,
        gapContextLinkCount: gapLinks.length,
        atomicGapCount: atomicGaps.length,
        actionCount: plan.items.length,
        actionGapLinkCount: actionLinks.length,
      },
      null,
      2,
    ),
  );
}

async function claimJob(jobId: string) {
  const now = new Date();
  const [job] = await db
    .update(backgroundJobs)
    .set({
      state: "running",
      attemptCount: 1,
      leaseOwner: workerId,
      leaseExpiresAt: new Date(now.getTime() + 30 * 60 * 1_000),
      heartbeatAt: now,
      startedAt: now,
      updatedAt: now,
    })
    .where(and(eq(backgroundJobs.id, jobId), eq(backgroundJobs.state, "queued")))
    .returning();
  if (!job) throw new Error(`Qualification job ${jobId} was not claimable`);
}

function assertNoPlaceholder(values: string[]) {
  const placeholders = [
    "Die Anforderung ist nicht erfüllt.",
    "Dokumentierte Maßnahmen zur Schließung dieser Lücke planen.",
    "The requirement is not fulfilled.",
    "Plan documented measures to close this gap.",
  ];
  if (
    values.some(
      (value) => !value.trim() || placeholders.some((placeholder) => value === placeholder),
    )
  ) {
    throw new Error("Qualification output contains placeholder content");
  }
}

function provider(): "openai" | "self_hosted" {
  const value = process.env.WORKFLOW_QUALIFICATION_PROVIDER ??
    (deterministic ? "self_hosted" : "openai");
  if (!["openai", "self_hosted"].includes(value)) {
    throw new Error("WORKFLOW_QUALIFICATION_PROVIDER is invalid");
  }
  return value as "openai" | "self_hosted";
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDbConnection);
