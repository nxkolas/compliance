import * as z from "zod";
import { jobDtoSchema } from "@/src/contracts/common/jobs";
import { request } from "./api-client";

const jobResponseSchema = z.object({ job: jobDtoSchema });

export const jobsClient = {
  async get(jobId: string, signal?: AbortSignal) {
    return request(`/api/jobs/${encodeURIComponent(jobId)}`, {
      outputSchema: jobResponseSchema,
      signal,
    });
  },

  async cancel(jobId: string, signal?: AbortSignal) {
    return request(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: "POST",
      outputSchema: jobResponseSchema,
      signal,
    });
  },
};
