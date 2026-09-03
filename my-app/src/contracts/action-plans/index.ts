import * as z from "zod";

export const actionPlanItemStatuses = [
  "open",
  "in_progress",
  "done",
  "cancelled",
] as const;
export const actionPlanItemStatusSchema = z.enum(actionPlanItemStatuses);
export const actionPlanGenerationRequestSchema = z.object({ gapRevisionId: z.uuid() });
export const actionPlanItemUpdateSchema = z.object({
  status: actionPlanItemStatusSchema,
}).strict();
export const actionPlanEntitySchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  sourceGapRevisionId: z.uuid(),
  generationJobId: z.uuid().nullable(),
  locale: z.enum(["de", "en"]),
  inputHash: z.string(),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime(),
});
export const actionPlanItemSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  actionPlanId: z.uuid(),
  findingId: z.uuid(),
  title: z.string(),
  result: z.string(),
  suggestedEvidence: z.array(z.string()),
  status: actionPlanItemStatusSchema,
  position: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const actionPlanGapSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  findingId: z.uuid(),
  stableKey: z.string(),
  kind: z.enum(["missing", "partial", "uncertain"]),
  statement: z.string(),
  recommendation: z.string(),
  position: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
export const actionPlanBundleSchema = z.object({
  plan: actionPlanEntitySchema,
  items: z.array(actionPlanItemSchema),
  categories: z.array(z.object({
    requirementVersionId: z.string(),
    title: z.string(),
    icon: z.string(),
    position: z.number().int().nonnegative(),
    actions: z.array(actionPlanItemSchema.extend({
      priority: z.enum(["low", "medium", "high", "critical"]),
      gaps: z.array(actionPlanGapSchema),
    })),
  })),
  sourceStaleness: z.object({ stale: z.boolean() }),
});
export const actionPlanProgressSchema = z.object({
  planId: z.uuid().nullable(),
  totalCount: z.number().int().nonnegative(),
  statuses: z.object({
    open: z.number().int().nonnegative(),
    in_progress: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }),
});
