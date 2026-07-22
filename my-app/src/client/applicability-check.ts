import * as z from "zod";
import { applicabilityResultSchema, applicabilitySubmissionSchema } from "@/src/contracts/applicability-check";
import { request } from "./api-client";

export const applicabilityCheckClient = {
  submit(url: string, input: z.infer<typeof applicabilitySubmissionSchema>, guestToken?: string) {
    return request(url, {
      method: "POST", input: applicabilitySubmissionSchema.parse(input),
      idempotencyKey: crypto.randomUUID(),
      outputSchema: z.object({ result: applicabilityResultSchema, resultUrl: z.string().optional() }),
      headers: guestToken ? { "x-guest-applicability-token": guestToken } : undefined,
    });
  },
  claim(input: { organizationId: string; checkId: string; token?: string }) {
    return request("/api/guest/applicability-check/claim", {
      method: "POST", input: { organizationId: input.organizationId, checkId: input.checkId },
      outputSchema: z.object({ result: z.object({ organizationId: z.uuid(), result: applicabilityResultSchema }) }),
      headers: input.token ? { "x-guest-applicability-token": input.token } : undefined,
    });
  },
  deleteGuest(checkId: string, token?: string) {
    return request("/api/guest/applicability-check/result", {
      method: "DELETE", input: { checkId }, outputSchema: z.object({ ok: z.literal(true) }),
      headers: token ? { "x-guest-applicability-token": token } : undefined,
    });
  },
};
