import * as z from "zod";
import {
  platformAdministratorGrantSchema,
  platformAdministratorSchema,
  platformAuditEventSchema,
  reasonSchema,
} from "@/src/contracts/admin";
import { jobDtoSchema } from "@/src/contracts/common/jobs";
import { request } from "./api-client";

export const platformAdminClient = {
  listAdministrators(cursor?: string) { return request(`/api/admin/platform-administrators${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { outputSchema: z.object({ administrators: z.array(platformAdministratorSchema) }) }); },
  grant(input: z.input<typeof platformAdministratorGrantSchema>) { return request("/api/admin/platform-administrators", { method: "POST", input: platformAdministratorGrantSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ administrator: platformAdministratorSchema }) }); },
  revoke(userId: string, input: z.input<typeof reasonSchema>) { return request(`/api/admin/platform-administrators/${encodeURIComponent(userId)}/deactivate`, { method: "POST", input: reasonSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ administrator: platformAdministratorSchema }) }); },
  listJobs(query = "") { return request(`/api/admin/jobs${query ? `?${query}` : ""}`, { outputSchema: z.object({ jobs: z.array(jobDtoSchema) }) }); },
  listAudit(query = "") { return request(`/api/admin/audit-events${query ? `?${query}` : ""}`, { outputSchema: z.object({ events: z.array(platformAuditEventSchema) }) }); },
};
