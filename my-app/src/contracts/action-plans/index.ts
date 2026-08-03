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
export const actionPlanEntitySchema = z.object({ id: z.uuid() }).loose();
export const actionPlanItemSchema = z.object({
  id: z.uuid(),
  status: actionPlanItemStatusSchema,
}).loose();
export const actionPlanBundleSchema = z.object({
  plan: actionPlanEntitySchema,
  items: z.array(actionPlanItemSchema),
  sourceStaleness: z.object({ stale: z.boolean() }).loose(),
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
