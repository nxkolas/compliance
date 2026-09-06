import * as z from "zod";

export const dashboardStepKeySchema = z.enum([
  "applicability",
  "gap_analysis",
  "action_plan",
]);
export const dashboardStepStatusSchema = z.enum([
  "locked",
  "not_started",
  "in_progress",
  "completed",
  "outdated",
]);
export const dashboardActivityCodeSchema = z.enum([
  "applicability_submitted",
  "gap_answer_saved",
  "gap_generated",
  "document_uploaded",
  "action_plan_created",
  "action_plan_item_status_changed",
  "report_ready",
]);
const dashboardActivityParameterSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export const dashboardActivityItemSchema = z.object({
  id: z.uuid(),
  code: dashboardActivityCodeSchema,
  actor: z.object({
    userId: z.uuid().nullable(),
    displayName: z.string(),
    initials: z.string(),
  }),
  occurredAt: z.iso.datetime(),
  entityType: z.string(),
  entityId: z.string(),
  params: z.record(z.string(), dashboardActivityParameterSchema),
  href: z.string().nullable(),
});
export const dashboardProgressPointSchema = z.object({
  at: z.iso.datetime(),
  percentage: z.number().int().min(0).max(100),
  applicability: z.number().int().min(0).max(100),
  gapAnalysis: z.number().int().min(0).max(100),
  actionPlan: z.number().int().min(0).max(100),
});
export const dashboardProgressMilestoneSchema = z.object({
  id: z.string(),
  code: dashboardActivityCodeSchema,
  occurredAt: z.iso.datetime(),
  percentage: z.number().int().min(0).max(100),
});
export const dashboardProgressHistorySchema = z.object({
  currentPercentage: z.number().int().min(0).max(100),
  previousPercentage: z.number().int().min(0).max(100),
  delta: z.number().int().min(-100).max(100),
  comparisonAt: z.iso.datetime().nullable(),
  points: z.array(dashboardProgressPointSchema),
  milestones: z.array(dashboardProgressMilestoneSchema),
});

export const dashboardActivityQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const currentYearStart = () =>
  new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
export const dashboardProgressHistoryQuerySchema = z.object({
  from: z.coerce.date().default(currentYearStart),
  to: z.coerce.date().default(() => new Date()),
  bucket: z.literal("month").default("month"),
}).refine(
  (value) => value.from <= value.to,
  { message: "from must be before to", path: ["to"] },
).refine(
  (value) => value.to.getTime() - value.from.getTime() <= 2 * 366 * 24 * 60 * 60 * 1000,
  { message: "Dashboard history range cannot exceed two years", path: ["to"] },
).refine(
  (value) => value.from <= new Date(),
  { message: "from cannot be in the future", path: ["from"] },
);

export const dashboardSchema = z.object({
  applicability: z.object({ outcome: z.string().nullable(), revisionId: z.uuid().nullable(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean() }),
  gap: z.object({
    revisionId: z.uuid().nullable(), findingCount: z.number().int(), criticalCount: z.number().int(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean(),
    progress: z.object({ answered: z.number().int().nonnegative(), total: z.number().int().nonnegative(), remaining: z.number().int().nonnegative(), percentage: z.number().int().min(0).max(100), updatedAt: z.iso.datetime().nullable() }),
  }),
  evidence: z.object({
    documentCount: z.number().int(), currentVersionCount: z.number().int(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean(),
    counts: z.object({ total: z.number().int().nonnegative(), active: z.number().int().nonnegative(), archived: z.number().int().nonnegative() }),
  }),
  plan: z.object({
    id: z.uuid().nullable(), openItems: z.number().int(), totalItems: z.number().int(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean(),
    statuses: z.object({ open: z.number().int().nonnegative(), inProgress: z.number().int().nonnegative(), done: z.number().int().nonnegative(), cancelled: z.number().int().nonnegative() }),
    percentage: z.number().int().min(0).max(100),
  }),
  report: z.object({ id: z.uuid().nullable(), state: z.string().nullable(), sourceUpdatedAt: z.iso.datetime().nullable(), stale: z.boolean(), outdated: z.boolean() }),
  workflow: z.object({
    steps: z.array(z.object({ key: dashboardStepKeySchema, status: dashboardStepStatusSchema, updatedAt: z.iso.datetime().nullable() })).length(3),
  }),
  recentActivity: z.array(dashboardActivityItemSchema),
  recentActivityNextCursor: z.string().nullable(),
  complianceProgress: dashboardProgressHistorySchema,
  nextSteps: z.array(z.string()),
});

export type DashboardActivityItem = z.infer<typeof dashboardActivityItemSchema>;
export type DashboardProgressHistory = z.infer<typeof dashboardProgressHistorySchema>;
