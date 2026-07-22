import * as z from "zod";
import {
  actionPlanEntitySchema,
  actionPlanItemSchema,
  actionPlanReconciliationSchema,
  actionPlanGenerationRequestSchema,
  actionPlanItemUpdateSchema,
  actionPlanReconciliationActivateSchema,
  actionPlanReconciliationDecisionSchema,
  actionPlanReconciliationPrepareSchema,
} from "@/src/contracts/action-plans";
import { request } from "./api-client";

const base = (id: string) => `/api/organizations/${encodeURIComponent(id)}/action-plan`;
export const actionPlansClient = {
  generate(organizationId: string, input: z.input<typeof actionPlanGenerationRequestSchema>) {
    return request(base(organizationId), { method: "POST", input: actionPlanGenerationRequestSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ plan: actionPlanEntitySchema, reused: z.boolean() }) });
  },
  updateItem(organizationId: string, itemId: string, input: z.input<typeof actionPlanItemUpdateSchema>, version: number) {
    return request(`${base(organizationId)}/items/${encodeURIComponent(itemId)}`, { method: "PATCH", input: actionPlanItemUpdateSchema.parse(input), ifMatch: version, outputSchema: z.object({ item: actionPlanItemSchema }) });
  },
  prepareReconciliation(organizationId: string, input: z.input<typeof actionPlanReconciliationPrepareSchema>) {
    return request(`${base(organizationId)}/reconciliation`, { method: "POST", input: actionPlanReconciliationPrepareSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ reconciliation: actionPlanReconciliationSchema }) });
  },
  decide(organizationId: string, itemId: string, input: z.input<typeof actionPlanReconciliationDecisionSchema>, version: number) {
    return request(`${base(organizationId)}/reconciliation/items/${encodeURIComponent(itemId)}`, { method: "PATCH", input: actionPlanReconciliationDecisionSchema.parse(input), ifMatch: version, outputSchema: z.object({ reconciliation: actionPlanReconciliationSchema }) });
  },
  activate(organizationId: string, input: z.input<typeof actionPlanReconciliationActivateSchema>, version: number) {
    return request(`${base(organizationId)}/reconciliation/activate`, { method: "POST", input: actionPlanReconciliationActivateSchema.parse(input), ifMatch: version, idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ result: z.object({ plan: actionPlanEntitySchema }).loose() }) });
  },
};
