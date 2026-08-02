import { createHash } from "node:crypto";
import { db } from "@/src/db";
import {
  actionPlanItemGaps,
  actionPlanItems,
  actionPlans,
  aiProcessingRuns,
  auditEvents,
  backgroundJobs,
  gapFindings,
  gapItems,
} from "@/src/db/schema";
import { currentGapDefinitionHash, getCurrentGapDefinition } from "@/src/server/definitions";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { requireOrganizationCapability } from "../auth/capability-service";
import { getCurrentActionPlan } from "./service";

const BUILD_HASH = process.env.APP_BUILD_SHA ?? currentGapDefinitionHash;

export async function enqueueActionPlanGeneration(input: {
  userId: string;
  organizationId: string;
  sourceGapRevisionId: string;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "plans:manage");
  if (await db.query.actionPlans.findFirst({ where: { RAW: (table, operators) => eq(table.organizationId, input.organizationId) ?? operators.sql`true` } })) {
    throw new ApiError(409, "This organization already has its one Action Plan", undefined, "ACTION_PLAN_ALREADY_EXISTS");
  }
  const output = await db.query.analysisOutputs.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, input.organizationId), eq(table.kind, "gap")) ?? operators.sql`true` },
  });
  if (output?.currentRevisionId !== input.sourceGapRevisionId) throw new ApiError(409, "Action Plan generation requires the current Gap revision");
  const blockers = await db.select({ id: gapFindings.id }).from(gapFindings).where(and(
    eq(gapFindings.outputRevisionId, input.sourceGapRevisionId),
    eq(gapFindings.materialContradiction, true),
    eq(gapFindings.contradictionResolved, false),
  ));
  if (blockers.length) throw new ApiError(409, "Resolve material contradictions before creating the Action Plan", { findingIds: blockers.map((item) => item.id) }, "ACTION_PLAN_CONTRADICTION_BLOCKED");
  const revision = await db.query.analysisOutputRevisions.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, input.sourceGapRevisionId), eq(table.organizationId, input.organizationId)) ?? operators.sql`true` },
  });
  if (!revision) throw new ApiError(404, "Gap revision not found");
  const [job] = await db.insert(backgroundJobs).values({
    organizationId: input.organizationId,
    kind: "action_plan_generation",
    payload: { sourceGapRevisionId: revision.id, locale: revision.locale, definitionHash: revision.definitionHash, buildHash: BUILD_HASH },
    requestedBy: input.userId,
  }).returning();
  if (!job) throw new Error("Action Plan job was not created");
  return job;
}

export async function executeActionPlanGenerationJob(input: {
  jobId: string;
  organizationId: string;
  userId: string;
  sourceGapRevisionId: string;
  locale: "de" | "en";
  attemptCount?: number;
  abortSignal?: AbortSignal;
}) {
  if (input.abortSignal?.aborted) throw input.abortSignal.reason;
  const existing = await db.query.actionPlans.findFirst({ where: { RAW: (table, operators) => eq(table.organizationId, input.organizationId) ?? operators.sql`true` } });
  if (existing) return { type: "action_plan", id: existing.id };
  const findings = await db.select().from(gapFindings).where(eq(gapFindings.outputRevisionId, input.sourceGapRevisionId)).orderBy(asc(gapFindings.position));
  const actionable = findings.filter((finding) => finding.status !== "fulfilled");
  const gaps = actionable.length ? await db.select().from(gapItems).where(inArray(gapItems.findingId, actionable.map((finding) => finding.id))).orderBy(asc(gapItems.position)) : [];
  const organization = await db.query.organizations.findFirst({ where: { RAW: (table, operators) => eq(table.id, input.organizationId) ?? operators.sql`true` } });
  const definition = getCurrentGapDefinition(input.locale);
  const manifest = { sourceGapRevisionId: input.sourceGapRevisionId, findingIds: actionable.map((item) => item.id), gapIds: gaps.map((item) => item.id) };
  const now = new Date();
  const [run] = await db.insert(aiProcessingRuns).values({
    organizationId: input.organizationId,
    jobId: input.jobId,
    operationKind: "action_plan_generation",
    status: "succeeded",
    provider: organization?.aiProviderMode ?? "company_hosted",
    model: "deterministic-action-plan-v1",
    promptName: definition.actionPlanPrompt.name,
    promptVersion: definition.actionPlanPrompt.version,
    promptHash: definition.actionPlanPrompt.templateHash,
    definitionHash: currentGapDefinitionHash,
    buildHash: BUILD_HASH,
    inputManifest: manifest,
    claimValidation: { version: 1, status: "validated", actionCount: actionable.length },
    validatedOutput: { version: 1, findingIds: actionable.map((item) => item.id) },
    outputLocale: input.locale,
    startedAt: now,
    completedAt: now,
  }).returning();
  if (!run) throw new Error("Action Plan AI run was not created");
  const [plan] = await db.insert(actionPlans).values({
    organizationId: input.organizationId,
    sourceGapRevisionId: input.sourceGapRevisionId,
    generationJobId: input.jobId,
    aiProcessingRunId: run.id,
    locale: input.locale,
    inputHash: hash(manifest),
    createdBy: input.userId,
  }).returning();
  if (!plan) throw new Error("Action Plan was not created");
  if (actionable.length) {
    const items = await db.insert(actionPlanItems).values(actionable.map((finding, position) => ({
      organizationId: input.organizationId,
      actionPlanId: plan.id,
      findingId: finding.id,
      title: finding.requirementTitle,
      description: finding.guidance,
      position,
    }))).returning();
    const links = items.flatMap((item) => gaps.filter((gap) => gap.findingId === item.findingId).map((gap) => ({
      organizationId: input.organizationId,
      actionPlanId: plan.id,
      actionPlanItemId: item.id,
      gapItemId: gap.id,
    })));
    if (links.length) await db.insert(actionPlanItemGaps).values(links);
  }
  await db.insert(auditEvents).values({
    organizationId: input.organizationId,
    actorUserId: input.userId,
    eventType: "action_plan.created",
    entityType: "action_plan",
    entityId: plan.id,
    metadata: { sourceGapRevisionId: input.sourceGapRevisionId },
  });
  return { type: "action_plan", id: plan.id };
}

export function generateActionPlanContent(input: { findings: Array<{ id: string; title: string; guidance: string }> }) {
  return input.findings.map((finding, position) => ({ findingId: finding.id, title: finding.title, description: finding.guidance, position }));
}

export async function activateGeneratedActionPlan(input: { userId: string; organizationId: string }) {
  return getCurrentActionPlan(input.userId, input.organizationId);
}

function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
