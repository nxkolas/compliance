import * as z from "zod";

export const actionPlanGenerationRequestSchema = z.object({ gapRevisionId: z.uuid() });
export const actionPlanItemUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "done"]),
}).strict();
export const actionPlanEntitySchema = z.object({ id: z.uuid() }).loose();
export const actionPlanItemSchema = z.object({
  id: z.uuid(),
  status: z.enum(["open", "in_progress", "done"]),
}).loose();
export const actionPlanBundleSchema = z.object({
  plan: actionPlanEntitySchema,
  items: z.array(actionPlanItemSchema),
  sourceStaleness: z.object({ stale: z.boolean() }).loose(),
});
