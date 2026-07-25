import * as z from "zod"; import { dashboardSchema } from "@/src/contracts/dashboard"; import { request } from "./api-client";
export const dashboardClient = { get(organizationId: string) { return request(`/api/organizations/${encodeURIComponent(organizationId)}/dashboard`, { outputSchema: z.object({ dashboard: dashboardSchema }) }); } };
