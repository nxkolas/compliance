import * as z from "zod";

export const actionPlanGenerationRequestSchema = z.object({ approvedGapRevisionId: z.uuid() });
export const actionPlanReconciliationPrepareSchema = z.object({ targetGapRevisionId: z.uuid() });
export const actionPlanReconciliationDecisionSchema = z.object({
  decision: z.enum(["carry_over", "close", "reopen", "create_follow_up", "keep_legacy", "cancel"]),
  reason: z.string().trim().min(1).max(2_000),
});
export const actionPlanReconciliationActivateSchema = z.object({ reconciliationId: z.uuid() });
export const actionPlanItemUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  ownerUserId: z.uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), "At least one action-item field is required");

export const actionPlanEntitySchema = z.object({ id: z.uuid(), version: z.number().int().positive() }).loose();
export const actionPlanItemSchema = z.object({ id: z.uuid(), version: z.number().int().positive() }).loose();
export const actionPlanBundleSchema = z.object({
  plan: actionPlanEntitySchema,
  items: z.array(actionPlanItemSchema),
  sourceStaleness: z.object({ stale: z.boolean() }).loose(),
});
export const actionPlanReconciliationSchema = z.object({
  reconciliation: z.object({ id: z.uuid(), version: z.number().int().positive() }).loose(),
  records: z.array(z.object({ id: z.uuid() }).loose()),
  ready: z.boolean(),
}).loose();
