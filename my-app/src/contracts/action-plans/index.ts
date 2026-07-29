import * as z from "zod";

export const actionPlanGenerationRequestSchema = z.object({ gapRevisionId: z.uuid() });
export const actionPlanItemUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
}).strict();

export const actionPlanEntitySchema = z.object({ id: z.uuid(), version: z.number().int().positive() }).loose();
export const actionPlanItemSchema = z.object({ id: z.uuid(), version: z.number().int().positive() }).loose();
export const actionPlanBundleSchema = z.object({
  plan: actionPlanEntitySchema,
  items: z.array(actionPlanItemSchema),
  sourceStaleness: z.object({ stale: z.boolean() }).loose(),
});
