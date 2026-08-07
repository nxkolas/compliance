import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  backgroundJobs,
  organizationMemberships,
  organizations,
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
  saveQuestionnaireDraftAnswer,
  submitGapQuestionnaire,
} from "@/src/server/gap-analysis";
import { succeedJob } from "@/src/server/jobs";
import { createOrganizationForUser } from "@/src/server/organizations/service";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { syncAuthenticatedUser } from "@/src/server/users";
import type { GroundingExecutionDependencies } from "@/src/server/ai/grounding/gateway";
import {
  DETERMINISTIC_APPLICABILITY_ANSWERS,
  deterministicGroundingDependencies,
} from "./grounded-workflow-fixture";

const ORGS_PER_USER = 3;

// One org per workflow stage: applicability only, applicability + Gap, and
// the fully complete org. The Gap prerequisite means each stage builds on the
// previous one.
const ORG_STAGE_LABELS = ["Betroffenheitscheck", "Gap-Analyse", "Aktionsplan"];

// The two users this seeding run targets. Pass user IDs as command-line
// arguments to seed different users instead.
const DEFAULT_USER_IDS = [
  "a5c5da60-3539-4c18-8b26-c9da96d49446",
  "b8a2c5f7-7f69-4893-af62-de06c8438432",
];

type SeedSummary = {
  userId: string;
  organizationId: string;
  organizationName: string;
  applicabilityRevisionId: string;
  gapRevisionId?: string;
  actionPlanId?: string;
  actionItemCount?: number;
};

async function main() {
  const userIds = parseUserIds();
  const deterministic = process.env.SEED_DEMO_ORGS_DETERMINISTIC !== "false";
  const providerMode = provider(deterministic);
  const workerId = `seed-demo-orgs-${randomUUID()}`;
  const namePrefix =
    process.env.SEED_DEMO_ORGS_NAME_PREFIX?.trim() || "Demo";
  const groundingDependencies = deterministic
    ? await deterministicGroundingDependencies(providerMode)
    : undefined;

  await resolvePinnedLegalScope({
    familyCodes: ["nis2-de-primary", "nis2-eu-primary"],
  });

  const summaries: SeedSummary[] = [];
  for (const userId of userIds) {
    const user = await resolveUser(userId);
    if (!user) {
      console.warn(
        `Skipping ${userId}: no user profile or Auth identity was found.`,
      );
      continue;
    }
    const label = user.email?.split("@")[0] || userId.slice(0, 8);
    for (let index = 0; index < ORGS_PER_USER; index++) {
      const organizationName = `${namePrefix} ${label} ${index + 1} (${ORG_STAGE_LABELS[index]})`;
      const summary = await createCompleteOrganization({
        userId,
        organizationName,
        stage: index,
        workerId,
        providerMode,
        groundingDependencies,
      });
      summaries.push(summary);
      const parts = [
        `applicability=${summary.applicabilityRevisionId}`,
        ...(summary.gapRevisionId
          ? [`gap=${summary.gapRevisionId}`]
          : []),
        ...(summary.actionPlanId ? [`actionPlan=${summary.actionPlanId}`] : []),
      ];
      console.log(
        `Created ${organizationName} (${summary.organizationId}): ${parts.join(", ")}`,
      );
    }
  }

  const verification = await verifySeededOrgs(userIds, namePrefix);
  console.log(
    JSON.stringify(
      { created: summaries, verified: verification },
      null,
      2,
    ),
  );
}

async function createCompleteOrganization(input: {
  userId: string;
  organizationName: string;
  stage: number;
  workerId: string;
  providerMode: "openai" | "self_hosted";
  groundingDependencies?: GroundingExecutionDependencies;
}): Promise<SeedSummary> {
  const {
    userId,
    organizationName,
    stage,
    workerId,
    providerMode,
    groundingDependencies,
  } = input;
  const organization = await createOrganizationForUser(userId, {
    name: organizationName,
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
      `Seeded applicability outcome is not gap-eligible: ${applicability.result.outcome}`,
    );
  }

  let gapRevisionId: string | undefined;
  let actionPlanId: string | undefined;
  let actionItemCount: number | undefined;

  if (stage >= 1) {
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
    if (!cycle) throw new Error("Seeded Gap cycle was not created");
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
      idempotencyKey: `seed-demo-gap-${randomUUID()}`,
    });
    await claimJob(gapEnqueue.job.id, workerId);
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
    gapRevisionId = gapResult.id;
  }

  if (stage >= 2) {
    if (!gapRevisionId) throw new Error("Gap revision is unavailable");
    const actionJob = await enqueueActionPlanGeneration({
      userId,
      organizationId: organization.id,
      sourceGapRevisionId: gapRevisionId,
    });
    await claimJob(actionJob.id, workerId);
    const actionResult = await executeActionPlanGenerationJob({
      jobId: actionJob.id,
      workerId,
      organizationId: organization.id,
      userId,
      sourceGapRevisionId: gapRevisionId,
      attemptCount: 1,
      locale: "de",
      groundingDependencies,
    });
    await succeedJob({ jobId: actionJob.id, workerId, result: actionResult });

    const plan = await getCurrentActionPlan(userId, organization.id);
    if (!plan || plan.items.length < 1) {
      throw new Error("Seeded Action Plan was not produced");
    }
    actionPlanId = plan.plan.id;
    actionItemCount = plan.items.length;
  }

  return {
    userId,
    organizationId: organization.id,
    organizationName,
    applicabilityRevisionId: applicability.outputRevisionId,
    ...(gapRevisionId ? { gapRevisionId } : {}),
    ...(actionPlanId ? { actionPlanId, actionItemCount } : {}),
  };
}

async function claimJob(jobId: string, workerId: string) {
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
  if (!job) throw new Error(`Seed job ${jobId} was not claimable`);
}

async function resolveUser(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: {
      RAW: (table, operators) => eq(table.userId, userId) ?? operators.sql`true`,
    },
  });
  if (profile) return profile;

  // The profile may simply not have been synced yet; fall back to Auth.
  const { data, error } = await getSupabaseAdminClient().auth.admin.getUserById(
    userId,
  );
  if (error || !data.user) return null;
  await syncAuthenticatedUser(data.user);
  return db.query.userProfiles.findFirst({
    where: {
      RAW: (table, operators) => eq(table.userId, userId) ?? operators.sql`true`,
    },
  });
}

async function verifySeededOrgs(
  userIds: string[],
  namePrefix: string,
) {
  const pattern = `%${namePrefix.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  return db
    .select({
      userId: organizationMemberships.userId,
      organizations: sql<number>`count(*)::int`,
      applicabilityComplete: sql<number>`
        count(*) filter (
          where exists (
            select 1 from analysis_outputs seeded_applicability
            where seeded_applicability.organization_id = ${organizations.id}
              and seeded_applicability.kind = 'applicability'
              and seeded_applicability.current_revision_id is not null
          )
        )::int
      `,
      gapGenerated: sql<number>`
        count(*) filter (
          where exists (
            select 1 from analysis_outputs seeded_gap
            where seeded_gap.organization_id = ${organizations.id}
              and seeded_gap.kind = 'gap'
              and seeded_gap.current_revision_id is not null
          )
        )::int
      `,
      actionPlanGenerated: sql<number>`
        count(*) filter (
          where exists (
            select 1 from action_plans seeded_action_plan
            where seeded_action_plan.organization_id = ${organizations.id}
          )
        )::int
      `,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.organizationId, organizations.id),
    )
    .where(
      and(
        inArray(organizationMemberships.userId, userIds),
        sql`${organizations.name} like ${pattern} escape '\\'`,
        isNull(organizations.archivedAt),
      ),
    )
    .groupBy(organizationMemberships.userId);
}

function parseUserIds(): string[] {
  const args = process.argv
    .slice(2)
    .flatMap((arg) => arg.split(","))
    .map((arg) => arg.trim())
    .filter(Boolean);
  const userIds = args.length ? args : DEFAULT_USER_IDS;
  return [...new Set(userIds)];
}

function provider(deterministic: boolean): "openai" | "self_hosted" {
  const value =
    process.env.SEED_DEMO_ORGS_PROVIDER ??
    (deterministic ? "self_hosted" : "openai");
  if (!["openai", "self_hosted"].includes(value)) {
    throw new Error("SEED_DEMO_ORGS_PROVIDER is invalid");
  }
  return value as "openai" | "self_hosted";
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
