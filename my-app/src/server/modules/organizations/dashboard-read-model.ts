import {
  and,
  desc,
  eq,
  inArray,
  lt,
  lte,
  or,
} from "drizzle-orm";
import * as z from "zod";
import type {
  DashboardActivityItem,
  DashboardProgressHistory,
} from "@/src/contracts/dashboard";
import { auditEvents, userProfiles } from "@/src/db/schema";
import { currentApplicabilityDefinitionHash } from "@/src/server/modules/applicability-check";
import {
  currentGapDefinitionHash,
  getCurrentGapDefinition,
} from "@/src/server/modules/gap-analysis";
import {
  authorizeOrganizationRead,
  type OrganizationScopeExecutor,
} from "@/src/server/platform/auth/organization-scope";
import { getCursorCodec } from "@/src/server/platform/http/pagination";
import {
  calculateDashboardProgress,
  type DashboardProgress,
} from "./dashboard-progress";

const activityEventTypes = [
  "applicability.submitted",
  "gap_questionnaire.answer_saved",
  "gap.generated",
  "document.uploaded",
  "action_plan.created",
  "action_plan_item.status_changed",
  "report.ready",
] as const;
const historyEventTypes = activityEventTypes.filter(
  (eventType) => eventType !== "document.uploaded" && eventType !== "report.ready",
);
const milestoneEventTypes = new Set([
  "applicability.submitted",
  "gap.generated",
  "action_plan.created",
]);
const activityCursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);
const actionStatuses = ["open", "in_progress", "done", "cancelled"] as const;
type ActionStatus = (typeof actionStatuses)[number];

type HistoryQuery = {
  from: Date;
  to: Date;
  bucket: "month";
};

export async function getOrganizationDashboard(
  userId: string,
  organizationId: string,
) {
  const { executor } = await authorizeOrganizationRead({
    actorUserId: userId,
    organizationId,
    capability: "organizations:read",
  });
  const base = await readDashboardBase(organizationId, executor);
  const range = defaultHistoryRange();
  const [activity, complianceProgress] = await Promise.all([
    listDashboardActivityPreauthorized({
      organizationId,
      limit: 4,
      executor,
    }),
    readDashboardProgressHistoryPreauthorized({
      organizationId,
      executor,
      current: base.progress,
      ...range,
    }),
  ]);

  return {
    ...base.dashboard,
    recentActivity: activity.items,
    recentActivityNextCursor: activity.nextCursor ?? null,
    complianceProgress,
  };
}

export async function listDashboardActivity(input: {
  userId: string;
  organizationId: string;
  limit: number;
  cursor?: string;
}) {
  const { executor } = await authorizeOrganizationRead({
    actorUserId: input.userId,
    organizationId: input.organizationId,
    capability: "organizations:read",
  });
  return listDashboardActivityPreauthorized({ ...input, executor });
}

export async function getDashboardProgressHistory(input: {
  userId: string;
  organizationId: string;
} & HistoryQuery): Promise<DashboardProgressHistory> {
  const { executor } = await authorizeOrganizationRead({
    actorUserId: input.userId,
    organizationId: input.organizationId,
    capability: "organizations:read",
  });
  const base = await readDashboardBase(input.organizationId, executor);
  return readDashboardProgressHistoryPreauthorized({
    organizationId: input.organizationId,
    executor,
    current: base.progress,
    ...resolveHistoryRange(input),
  });
}

async function readDashboardBase(
  organizationId: string,
  db: OrganizationScopeExecutor,
) {
  const [outputs, plan, documentRows, latestReport, gapCycle] =
    await Promise.all([
      db.query.analysisOutputs.findMany({
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.organizationId, organizationId),
              inArray(table.kind, ["applicability", "gap"]),
            ) ?? operators.sql`true`,
        },
      }),
      db.query.actionPlans.findFirst({
        where: {
          RAW: (table, operators) =>
            eq(table.organizationId, organizationId) ?? operators.sql`true`,
        },
      }),
      db.query.documents.findMany({
        where: {
          RAW: (table, operators) =>
            eq(table.organizationId, organizationId) ?? operators.sql`true`,
        },
      }),
      db.query.reports.findFirst({
        where: {
          RAW: (table, operators) =>
            eq(table.organizationId, organizationId) ?? operators.sql`true`,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.query.gapAnalysisCycles.findFirst({
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.organizationId, organizationId),
              eq(table.definitionHash, currentGapDefinitionHash),
            ) ?? operators.sql`true`,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
  const applicabilityId =
    outputs.find((output) => output.kind === "applicability")
      ?.currentRevisionId ?? null;
  const gapId =
    outputs.find((output) => output.kind === "gap")?.currentRevisionId ?? null;
  const [applicability, gap, findings, items, reportJob] = await Promise.all([
    applicabilityId
      ? db.query.analysisOutputRevisions.findFirst({
          where: {
            RAW: (table, operators) =>
              eq(table.id, applicabilityId) ?? operators.sql`true`,
          },
        })
      : null,
    gapId
      ? db.query.analysisOutputRevisions.findFirst({
          where: {
            RAW: (table, operators) =>
              eq(table.id, gapId) ?? operators.sql`true`,
          },
        })
      : null,
    gapId
      ? db.query.gapFindings.findMany({
          where: {
            RAW: (table, operators) =>
              eq(table.outputRevisionId, gapId) ?? operators.sql`true`,
          },
        })
      : [],
    plan
      ? db.query.actionPlanItems.findMany({
          where: {
            RAW: (table, operators) =>
              eq(table.actionPlanId, plan.id) ?? operators.sql`true`,
          },
        })
      : [],
    latestReport
      ? db.query.backgroundJobs.findFirst({
          where: {
            RAW: (table, operators) =>
              eq(table.id, latestReport.renderingJobId) ?? operators.sql`true`,
          },
        })
      : null,
  ]);

  const requiredQuestions = getCurrentGapDefinition("de").questions.filter(
    (question) => question.required,
  );
  const draftAnswers = gapCycle?.draftAnswers ?? {};
  const answeredRequired = requiredQuestions.filter((question) =>
    question.options.some(
      (option) => option.stableValue === draftAnswers[question.stableKey],
    ),
  ).length;
  const statuses = {
    open: items.filter((item) => item.status === "open").length,
    inProgress: items.filter((item) => item.status === "in_progress").length,
    done: items.filter((item) => item.status === "done").length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
  };
  const progress = calculateDashboardProgress({
    applicabilityAccepted: Boolean(applicabilityId),
    applicabilityOutcome: applicability?.outcomeCode,
    gapAccepted: Boolean(gapId),
    gapAnswered: answeredRequired,
    gapTotal: requiredQuestions.length,
    actionPlanExists: Boolean(plan),
    actionStatuses: statuses,
  });
  const activeDocuments = documentRows.filter(
    (document) => !document.archivedAt,
  );
  const archivedDocuments = documentRows.filter((document) =>
    Boolean(document.archivedAt),
  );
  const evidenceUpdatedAt = latestDate(
    documentRows.map((document) => document.updatedAt),
  );
  const planUpdatedAt = latestDate(
    [plan?.createdAt, ...items.map((item) => item.updatedAt)].filter(
      (value): value is Date => Boolean(value),
    ),
  );
  const reportOutdated = Boolean(
    latestReport &&
      (latestReport.applicabilityRevisionId !== applicabilityId ||
        latestReport.gapRevisionId !== gapId ||
        latestReport.actionPlanId !== (plan?.id ?? null)),
  );
  const applicabilityOutdated = Boolean(
    applicability &&
      applicability.definitionHash !== currentApplicabilityDefinitionHash,
  );
  const gapOutdated = Boolean(
    gap && gap.definitionHash !== currentGapDefinitionHash,
  );
  const planStale = Boolean(plan && plan.sourceGapRevisionId !== gapId);
  const nextSteps: string[] = [];
  if (!applicabilityId) nextSteps.push("complete_applicability_check");
  if (!gapId) nextSteps.push("complete_gap_analysis");
  if (!activeDocuments.some((document) => document.currentVersionId))
    nextSteps.push("upload_evidence");
  if (gapId && !plan) nextSteps.push("create_action_plan");
  if (
    plan &&
    items.some(
      (item) => item.status === "open" || item.status === "in_progress",
    )
  )
    nextSteps.push("work_action_plan");

  return {
    progress,
    dashboard: {
      applicability: {
        outcome: applicability?.outcomeCode ?? null,
        revisionId: applicabilityId,
        sourceUpdatedAt: applicability?.createdAt.toISOString() ?? null,
        stale: false,
        outdated: applicabilityOutdated,
      },
      gap: {
        revisionId: gapId,
        findingCount: findings.length,
        criticalCount: findings.filter(
          (finding) =>
            finding.criticality === "critical" &&
            finding.status !== "fulfilled",
        ).length,
        sourceUpdatedAt: gap?.createdAt.toISOString() ?? null,
        stale: false,
        outdated: gapOutdated,
        progress: {
          answered: gapId ? requiredQuestions.length : answeredRequired,
          total: requiredQuestions.length,
          remaining: gapId
            ? 0
            : Math.max(requiredQuestions.length - answeredRequired, 0),
          percentage: progress.gapAnalysis,
          updatedAt:
            gap?.createdAt.toISOString() ??
            gapCycle?.updatedAt.toISOString() ??
            null,
        },
      },
      evidence: {
        documentCount: documentRows.length,
        currentVersionCount: activeDocuments.filter(
          (document) => document.currentVersionId,
        ).length,
        sourceUpdatedAt: evidenceUpdatedAt?.toISOString() ?? null,
        stale: archivedDocuments.length > 0,
        outdated: false,
        counts: {
          total: documentRows.length,
          active: activeDocuments.length,
          archived: archivedDocuments.length,
        },
      },
      plan: {
        id: plan?.id ?? null,
        openItems: items.filter((item) => item.status !== "done").length,
        totalItems: items.length,
        sourceUpdatedAt: planUpdatedAt?.toISOString() ?? null,
        stale: planStale,
        outdated: false,
        statuses,
        percentage: progress.actionPlan,
      },
      report: {
        id: latestReport?.id ?? null,
        state: latestReport
          ? reportState(latestReport.pdfKey, reportJob?.state)
          : null,
        sourceUpdatedAt: latestReport
          ? (reportJob?.updatedAt ?? latestReport.createdAt).toISOString()
          : null,
        stale: reportOutdated,
        outdated: reportOutdated,
      },
      workflow: {
        steps: [
          {
            key: "applicability" as const,
            status: applicabilityOutdated
              ? ("outdated" as const)
              : applicabilityId
                ? ("completed" as const)
                : ("not_started" as const),
            updatedAt: applicability?.createdAt.toISOString() ?? null,
          },
          {
            key: "gap_analysis" as const,
            status: gapOutdated
              ? ("outdated" as const)
              : gapId
                ? ("completed" as const)
                : gapCycle
                  ? ("in_progress" as const)
                  : applicabilityId
                    ? ("not_started" as const)
                    : ("locked" as const),
            updatedAt:
              gap?.createdAt.toISOString() ??
              gapCycle?.updatedAt.toISOString() ??
              null,
          },
          {
            key: "action_plan" as const,
            status: planStale
              ? ("outdated" as const)
              : plan
                ? items.length > 0 && items.every(
                    (item) =>
                      item.status === "done" || item.status === "cancelled",
                  )
                  ? ("completed" as const)
                  : ("in_progress" as const)
                : gapId
                  ? ("not_started" as const)
                  : ("locked" as const),
            updatedAt: planUpdatedAt?.toISOString() ?? null,
          },
        ],
      },
      nextSteps,
    },
  };
}

async function listDashboardActivityPreauthorized(input: {
  organizationId: string;
  limit: number;
  cursor?: string;
  executor: OrganizationScopeExecutor;
}) {
  const scope = `dashboard-activity:${input.organizationId}`;
  const cursor = input.cursor
    ? activityCursorSchema.parse(getCursorCodec().decode(input.cursor, scope))
    : null;
  const rows = await input.executor
    .select({ event: auditEvents, profile: userProfiles })
    .from(auditEvents)
    .leftJoin(userProfiles, eq(userProfiles.userId, auditEvents.actorUserId))
    .where(
      and(
        eq(auditEvents.organizationId, input.organizationId),
        inArray(auditEvents.eventType, activityEventTypes),
        cursor
          ? or(
              lt(auditEvents.occurredAt, new Date(cursor[0])),
              and(
                eq(auditEvents.occurredAt, new Date(cursor[0])),
                lt(auditEvents.id, cursor[1]),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
    .limit(input.limit + 1);
  const page = rows.slice(0, input.limit);
  const last = page.at(-1)?.event;
  return {
    items: page.map(({ event, profile }) =>
      toActivityItem(input.organizationId, event, profile),
    ),
    nextCursor:
      rows.length > input.limit && last
        ? getCursorCodec().encode(scope, [
            last.occurredAt.toISOString(),
            last.id,
          ])
        : undefined,
  };
}

async function readDashboardProgressHistoryPreauthorized(input: {
  organizationId: string;
  executor: OrganizationScopeExecutor;
  current: DashboardProgress;
  from: Date;
  to: Date;
  now: Date;
}): Promise<DashboardProgressHistory> {
  const events = await input.executor.query.auditEvents.findMany({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, input.organizationId),
          inArray(table.eventType, historyEventTypes),
          lte(table.occurredAt, input.to),
        ) ?? operators.sql`true`,
    },
    orderBy: { occurredAt: "asc", id: "asc" },
  });
  return buildDashboardProgressHistory({ ...input, events });
}

export function buildDashboardProgressHistory(input: {
  events: Array<{
    id: string;
    eventType: string;
    entityId: string;
    metadata: unknown;
    occurredAt: Date;
  }>;
  current: DashboardProgress;
  from: Date;
  to: Date;
  now: Date;
}): DashboardProgressHistory {
  const state: ReplayState = {
    applicabilityAccepted: false,
    applicabilityOutcome: null,
    gapAccepted: false,
    gapAnswered: 0,
    gapTotal: 0,
    actionPlanExists: false,
    actionPlanId: null,
    actionTotal: 0,
    itemStatuses: new Map(),
  };
  const snapshots: Array<{ at: Date; progress: DashboardProgress }> = [];
  const milestones: DashboardProgressHistory["milestones"] = [];
  for (const event of input.events) {
    applyHistoryEvent(state, event);
    const progress = replayProgress(state);
    snapshots.push({ at: event.occurredAt, progress });
    if (
      event.occurredAt >= input.from &&
      milestoneEventTypes.has(event.eventType)
    ) {
      milestones.push({
        id: event.id,
        code: activityCode(event.eventType),
        occurredAt: event.occurredAt.toISOString(),
        percentage: progress.percentage,
      });
    }
  }

  const points = monthBucketEnds(input.from, input.to).map((at) => {
    const snapshot = snapshots.findLast((item) => item.at <= at);
    return toProgressPoint(at, snapshot?.progress ?? emptyProgress());
  });
  if (input.now >= input.from && input.now <= input.to) {
    const currentPoint = toProgressPoint(input.now, input.current);
    if (points.length && sameUtcMonth(new Date(points.at(-1)!.at), input.now))
      points[points.length - 1] = currentPoint;
    else points.push(currentPoint);
  }
  if (!points.length) {
    const snapshot = snapshots.findLast((item) => item.at <= input.to);
    points.push(toProgressPoint(input.to, snapshot?.progress ?? emptyProgress()));
  }
  const latest = points.at(-1)!;
  const previous = points.at(-2);
  return {
    currentPercentage: latest.percentage,
    previousPercentage: previous?.percentage ?? latest.percentage,
    delta: latest.percentage - (previous?.percentage ?? latest.percentage),
    comparisonAt: previous?.at ?? null,
    points,
    milestones,
  };
}

type ReplayState = {
  applicabilityAccepted: boolean;
  applicabilityOutcome: string | null;
  gapAccepted: boolean;
  gapAnswered: number;
  gapTotal: number;
  actionPlanExists: boolean;
  actionPlanId: string | null;
  actionTotal: number;
  itemStatuses: Map<string, ActionStatus>;
};

function applyHistoryEvent(
  state: ReplayState,
  event: { eventType: string; entityId: string; metadata: unknown },
) {
  const metadata = primitiveMetadata(event.metadata);
  if (event.eventType === "applicability.submitted") {
    state.applicabilityAccepted = true;
    state.applicabilityOutcome = textValue(metadata.outcome);
  } else if (event.eventType === "gap_questionnaire.answer_saved") {
    state.gapAnswered = numberValue(metadata.answeredRequired);
    state.gapTotal = numberValue(metadata.totalRequired);
  } else if (event.eventType === "gap.generated") {
    state.gapAccepted = true;
  } else if (event.eventType === "action_plan.created") {
    state.actionPlanExists = true;
    state.actionPlanId = event.entityId;
    state.actionTotal = numberValue(metadata.itemCount);
    state.itemStatuses.clear();
  } else if (event.eventType === "action_plan_item.status_changed") {
    const status = textValue(metadata.status);
    const planId = textValue(metadata.actionPlanId);
    if (
      actionStatuses.includes(status as ActionStatus) &&
      (!planId || !state.actionPlanId || planId === state.actionPlanId)
    ) {
      state.actionPlanExists = true;
      state.itemStatuses.set(event.entityId, status as ActionStatus);
      state.actionTotal = Math.max(state.actionTotal, state.itemStatuses.size);
    }
  }
}

function replayProgress(state: ReplayState) {
  const explicit = [...state.itemStatuses.values()];
  const statuses = {
    open:
      explicit.filter((status) => status === "open").length +
      Math.max(state.actionTotal - explicit.length, 0),
    inProgress: explicit.filter((status) => status === "in_progress").length,
    done: explicit.filter((status) => status === "done").length,
    cancelled: explicit.filter((status) => status === "cancelled").length,
  };
  return calculateDashboardProgress({
    applicabilityAccepted: state.applicabilityAccepted,
    applicabilityOutcome: state.applicabilityOutcome,
    gapAccepted: state.gapAccepted,
    gapAnswered: state.gapAnswered,
    gapTotal: state.gapTotal,
    actionPlanExists: state.actionPlanExists,
    actionStatuses: statuses,
  });
}

function toActivityItem(
  organizationId: string,
  event: typeof auditEvents.$inferSelect,
  profile: typeof userProfiles.$inferSelect | null,
): DashboardActivityItem {
  const displayName =
    profile?.displayName?.trim() ||
    profile?.email.split("@")[0] ||
    "System";
  return {
    id: event.id,
    code: activityCode(event.eventType),
    actor: {
      userId: event.actorUserId,
      displayName,
      initials: initials(displayName),
    },
    occurredAt: event.occurredAt.toISOString(),
    entityType: event.entityType,
    entityId: event.entityId,
    params: activityParams(event.eventType, event.metadata),
    href: activityHref(organizationId, event.eventType),
  };
}

function activityCode(eventType: string): DashboardActivityItem["code"] {
  const codes: Record<string, DashboardActivityItem["code"]> = {
    "applicability.submitted": "applicability_submitted",
    "gap_questionnaire.answer_saved": "gap_answer_saved",
    "gap.generated": "gap_generated",
    "document.uploaded": "document_uploaded",
    "action_plan.created": "action_plan_created",
    "action_plan_item.status_changed": "action_plan_item_status_changed",
    "report.ready": "report_ready",
  };
  return codes[eventType] ?? "gap_generated";
}

function activityHref(organizationId: string, eventType: string) {
  const base = `/tool/organizations/${encodeURIComponent(organizationId)}`;
  if (eventType === "applicability.submitted")
    return `${base}/applicability-check`;
  if (
    eventType === "gap_questionnaire.answer_saved" ||
    eventType === "gap.generated"
  )
    return `${base}/gap-analysis`;
  if (eventType === "document.uploaded") return `${base}/documents`;
  if (
    eventType === "action_plan.created" ||
    eventType === "action_plan_item.status_changed"
  )
    return `${base}/action-plan`;
  if (eventType === "report.ready") return `${base}/pdf-export`;
  return null;
}

function primitiveMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (
        entry,
      ): entry is [string, string | number | boolean | null] =>
        entry[1] === null ||
        typeof entry[1] === "string" ||
        typeof entry[1] === "number" ||
        typeof entry[1] === "boolean",
    ),
  );
}

function activityParams(eventType: string, value: unknown) {
  const metadata = primitiveMetadata(value);
  const keys: Record<string, string[]> = {
    "applicability.submitted": ["outcome"],
    "gap_questionnaire.answer_saved": [
      "questionKey",
      "questionPosition",
      "answeredRequired",
      "totalRequired",
    ],
    "gap.generated": [],
    "document.uploaded": ["documentId", "documentTitle"],
    "action_plan.created": ["itemCount"],
    "action_plan_item.status_changed": [
      "itemTitle",
      "previousStatus",
      "status",
    ],
    "report.ready": [],
  };
  return Object.fromEntries(
    (keys[eventType] ?? []).flatMap((key) =>
      key in metadata ? [[key, metadata[key]]] : [],
    ),
  );
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join("") || "?"
  );
}

function numberValue(value: string | number | boolean | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textValue(value: string | number | boolean | null | undefined) {
  return typeof value === "string" ? value : null;
}

function resolveHistoryRange(query: HistoryQuery) {
  const now = new Date();
  return {
    from: query.from,
    to: query.to > now ? now : query.to,
    now,
  };
}

function defaultHistoryRange(now = new Date()) {
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
    to: now,
    now,
  };
}

function monthBucketEnds(from: Date, to: Date) {
  const ends: Date[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  for (;;) {
    const end = new Date(Date.UTC(year, month + 1, 1) - 1);
    if (end >= to) {
      ends.push(to);
      return ends;
    }
    ends.push(end);
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
}

function sameUtcMonth(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth()
  );
}

function toProgressPoint(at: Date, progress: DashboardProgress) {
  return {
    at: at.toISOString(),
    percentage: progress.percentage,
    applicability: progress.applicability,
    gapAnalysis: progress.gapAnalysis,
    actionPlan: progress.actionPlan,
  };
}

function emptyProgress(): DashboardProgress {
  return {
    percentage: 0,
    applicability: 0,
    gapAnalysis: 0,
    actionPlan: 0,
  };
}

function latestDate(values: Date[]) {
  return values.length
    ? new Date(Math.max(...values.map((value) => value.getTime())))
    : null;
}

function reportState(pdfKey: string | null, jobState?: string) {
  if (pdfKey) return "ready";
  if (jobState === "failed" || jobState === "cancelled") return jobState;
  if (jobState === "running" || jobState === "leased") return "rendering";
  return "queued";
}
