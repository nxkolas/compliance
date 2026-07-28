import * as z from "zod";
import { request } from "@/src/client/api-client";
import { organizationProgressSchema } from "@/src/contracts/organization-progress";

export { applyWelcomeCompletion } from "@/src/organization-progress/model";

const organizationProgressResponseSchema = z.object({
  progress: organizationProgressSchema,
});

export const organizationProgressClient = {
  get(organizationId: string) {
    return request(
      `/api/organizations/${encodeURIComponent(organizationId)}/progress`,
      { outputSchema: organizationProgressResponseSchema },
    );
  },
};
