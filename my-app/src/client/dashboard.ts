import * as z from "zod";
import {
  dashboardActivityItemSchema,
  dashboardProgressHistorySchema,
  dashboardSchema,
} from "@/src/contracts/dashboard";
import { request } from "./api-client";

export const dashboardClient = {
  get(organizationId: string) {
    return request(
      `/api/organizations/${encodeURIComponent(organizationId)}/dashboard`,
      { outputSchema: z.object({ dashboard: dashboardSchema }) },
    );
  },

  listActivity(
    organizationId: string,
    query: { limit?: number; cursor?: string } = {},
  ) {
    const search = new URLSearchParams();
    if (query.limit !== undefined) search.set("limit", String(query.limit));
    if (query.cursor) search.set("cursor", query.cursor);
    const suffix = search.size ? `?${search}` : "";
    return request(
      `/api/organizations/${encodeURIComponent(organizationId)}/dashboard/activity${suffix}`,
      { outputSchema: z.object({ activity: z.array(dashboardActivityItemSchema) }) },
    );
  },

  getProgressHistory(
    organizationId: string,
    query: { from?: Date; to?: Date } = {},
  ) {
    const search = new URLSearchParams();
    if (query.from) search.set("from", query.from.toISOString());
    if (query.to) search.set("to", query.to.toISOString());
    const suffix = search.size ? `?${search}` : "";
    return request(
      `/api/organizations/${encodeURIComponent(organizationId)}/dashboard/progress-history${suffix}`,
      { outputSchema: z.object({ history: dashboardProgressHistorySchema }) },
    );
  },
};
