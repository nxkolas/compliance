import * as z from "zod";
import { jobDtoSchema } from "@/src/contracts/common/jobs";
import { reportCreateSchema, reportDetailSchema, reportSchema } from "@/src/contracts/reports";
import { request } from "./api-client";
const base = (organizationId: string) => `/api/organizations/${encodeURIComponent(organizationId)}/reports`;
export const reportsClient = {
  create(organizationId: string, input: z.input<typeof reportCreateSchema>) {
    return request(base(organizationId), { method: "POST", input: reportCreateSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ report: reportSchema, job: jobDtoSchema, reused: z.boolean() }) });
  },
  get(organizationId: string, reportId: string) {
    return request(`${base(organizationId)}/${encodeURIComponent(reportId)}`, { outputSchema: reportDetailSchema });
  },
  download(organizationId: string, reportId: string) {
    return request(`${base(organizationId)}/${encodeURIComponent(reportId)}/download`, { method: "POST", outputSchema: z.object({ download: z.object({ url: z.url(), expiresInSeconds: z.number().int().positive() }) }) });
  },
};
