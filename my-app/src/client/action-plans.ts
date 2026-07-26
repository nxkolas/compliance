import * as z from "zod";
import {
  actionPlanItemSchema,
  actionPlanGenerationRequestSchema,
  actionPlanItemUpdateSchema,
} from "@/src/contracts/action-plans";
import { jobDtoSchema } from "@/src/contracts/common/jobs";
import { request } from "./api-client";

const base = (id: string) => `/api/organizations/${encodeURIComponent(id)}/action-plan`;
export const actionPlansClient = {
  generate(organizationId: string, input: z.input<typeof actionPlanGenerationRequestSchema>) {
    return request(base(organizationId), { method: "POST", input: actionPlanGenerationRequestSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ job: jobDtoSchema, reused: z.boolean() }) });
  },
  updateItem(organizationId: string, itemId: string, input: z.input<typeof actionPlanItemUpdateSchema>, version: number) {
    return request(`${base(organizationId)}/items/${encodeURIComponent(itemId)}`, { method: "PATCH", input: actionPlanItemUpdateSchema.parse(input), ifMatch: version, outputSchema: z.object({ item: actionPlanItemSchema }) });
  },
};
