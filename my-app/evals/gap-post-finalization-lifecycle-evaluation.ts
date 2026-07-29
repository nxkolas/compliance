import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import { actionPlanItemUpdateSchema } from "@/src/contracts/action-plans";
import { updateActionPlanItem } from "@/src/server/action-plans/service";
import {
  correctGapRevision,
  regenerateGapFindingGuidance,
} from "@/src/server/gap-analysis";
import { ApiError } from "@/src/server/api/errors";

const USER_ID =
  process.env.MANUAL_GAP_EVAL_USER_ID?.trim() ||
  "b8a2c5f7-7f69-4893-af62-de06c8438432";

type CaseResult = {
  organization: { id: string };
  workflow: { finalRevisionId: string };
  finalRevision: {
    findings: Array<{
      id: string;
      requirementCode: string;
    }>;
  };
  actionPlan: {
    plan: { id: string };
    items: Array<{
      id: string;
      version: number;
      requirementCode: string;
    }>;
  };
};

async function main() {
  const casePath = requiredArgument("--case", 0);
  const outputPath = resolve(
    requiredArgument("--output", 1),
  );
  const result = JSON.parse(
    await readFile(resolve(casePath), "utf8"),
  ) as CaseResult;
  const item = result.actionPlan.items[0];
  if (!item) {
    throw new Error("The supplied case has no action-plan item");
  }
  const finding = result.finalRevision.findings.find(
    (candidate) =>
      candidate.requirementCode === item.requirementCode,
  );
  if (!finding) {
    throw new Error(
      `Missing source finding ${item.requirementCode}`,
    );
  }

  const nonStatusPatch = actionPlanItemUpdateSchema.safeParse({
    ownerUserId: USER_ID,
    dueDate: "2026-08-31",
    executionNotes: "Users must not update execution metadata.",
  });

  const updated = await updateActionPlanItem({
    userId: USER_ID,
    organizationId: result.organization.id,
    itemId: item.id,
    status: "in_progress",
    expectedVersion: item.version,
  });

  const staleUpdate = await captureApiError(() =>
    updateActionPlanItem({
      userId: USER_ID,
      organizationId: result.organization.id,
      itemId: item.id,
      status: "done",
      expectedVersion: item.version,
    }),
  );
  const correctionAfterPlan = await captureApiError(() =>
    correctGapRevision({
      userId: USER_ID,
      organizationId: result.organization.id,
      sourceRevisionId: result.workflow.finalRevisionId,
      corrections: [
        {
          findingId: finding.id,
          requiresReview: false,
          reason:
            "Manual QA attempt to mutate a finalized Gap revision.",
          resolutionReason:
            "This attempt must be rejected by the action-plan lock.",
        },
      ],
    }),
  );
  const regenerationAfterPlan = await captureApiError(() =>
    regenerateGapFindingGuidance({
      userId: USER_ID,
      organizationId: result.organization.id,
      sourceRevisionId: result.workflow.finalRevisionId,
      findingId: finding.id,
      reason:
        "Manual QA attempt to regenerate guidance after finalization.",
    }),
  );
  const auditEvent = await db.query.auditEvents.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.eventType, "action_plan_item.updated"),
          eq(table.entityType, "action_plan_item"),
          eq(table.entityId, item.id),
        ) ?? operators.sql`true`,
    },
    orderBy: { createdAt: "desc" },
  });

  const checks = [
    {
      name: "Non-status action-plan fields reject patches",
      passed:
        !nonStatusPatch.success &&
        nonStatusPatch.error.issues.some(
          (issue) => issue.code === "unrecognized_keys",
        ),
      actual: nonStatusPatch.success
        ? "accepted"
        : nonStatusPatch.error.issues,
    },
    {
      name: "Action-plan status is editable",
      passed:
        updated.status === "in_progress" &&
        updated.version === item.version + 1,
      actual: {
        status: updated.status,
        version: updated.version,
      },
    },
    {
      name: "Execution update is audited with before/changes metadata",
      passed:
        auditEvent?.actorUserId === USER_ID &&
        hasBeforeAndChanges(auditEvent?.metadata),
      actual: auditEvent ?? null,
    },
    {
      name: "Stale execution update fails optimistic concurrency",
      passed:
        staleUpdate.status === 412 &&
        staleUpdate.code === "PRECONDITION_FAILED",
      actual: staleUpdate,
    },
    {
      name: "Correction is rejected after action-plan creation",
      passed:
        correctionAfterPlan.status === 409 &&
        correctionAfterPlan.code === "GAP_LOCKED_BY_ACTION_PLAN",
      actual: correctionAfterPlan,
    },
    {
      name: "Guidance regeneration is rejected after action-plan creation",
      passed:
        regenerationAfterPlan.status === 409 &&
        regenerationAfterPlan.code ===
          "GAP_LOCKED_BY_ACTION_PLAN",
      actual: regenerationAfterPlan,
    },
  ];
  const output = {
    evaluatedAt: new Date().toISOString(),
    sourceCase: resolve(casePath),
    organizationId: result.organization.id,
    actionPlanId: result.actionPlan.plan.id,
    itemId: item.id,
    checks,
    passed: checks.every((check) => check.passed),
  };
  await writeFile(
    outputPath,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );
  if (!output.passed) {
    process.exitCode = 1;
  }
}

async function captureApiError(
  operation: () => Promise<unknown>,
): Promise<{
  status: number | null;
  code: string | null;
  message: string;
}> {
  try {
    await operation();
    return {
      status: null,
      code: null,
      message: "Operation unexpectedly succeeded",
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        status: error.status,
        code: error.code,
        message: error.message,
      };
    }
    throw error;
  }
}

function hasBeforeAndChanges(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }
  return "before" in value && "changes" in value;
}

function requiredArgument(name: string, positionalIndex: number) {
  const index = process.argv.indexOf(name);
  const positionalArguments = process.argv
    .slice(2)
    .filter(
      (argument, argumentIndex, argumentsList) =>
        !argument.startsWith("--") &&
        !argumentsList[argumentIndex - 1]?.startsWith("--"),
    );
  const value =
    index >= 0
      ? process.argv[index + 1]
      : positionalArguments[positionalIndex];
  if (!value?.trim()) {
    throw new Error(`Missing required ${name} argument`);
  }
  return value;
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(closeDbConnection);
