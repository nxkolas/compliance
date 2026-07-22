import * as z from "zod";
import { invitationInputSchema, invitationSchema, organizationAiProviderPolicySchema, organizationAiProviderPolicyUpdateSchema, organizationInputSchema, organizationSchema } from "@/src/contracts/organizations";
import { request } from "./api-client";

const base = (organizationId?: string) => organizationId
  ? `/api/organizations/${encodeURIComponent(organizationId)}`
  : "/api/organizations";

export const organizationsClient = {
  create(input: z.input<typeof organizationInputSchema>, signal?: AbortSignal) {
    return request(base(), { method: "POST", input: organizationInputSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ organization: organizationSchema }), signal });
  },
  update(organizationId: string, input: z.input<typeof organizationInputSchema>, ifMatch: number, signal?: AbortSignal) {
    return request(base(organizationId), { method: "PATCH", input: organizationInputSchema.parse(input), ifMatch, outputSchema: z.object({ organization: organizationSchema }), signal });
  },
  invite(organizationId: string, input: z.input<typeof invitationInputSchema>, signal?: AbortSignal) {
    return request(`${base(organizationId)}/invitations`, { method: "POST", input: invitationInputSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ invitation: invitationSchema }), signal });
  },
  acceptInvitation(invitationId: string, signal?: AbortSignal) {
    return request(`/api/organization-invitations/${encodeURIComponent(invitationId)}/accept`, { method: "POST", outputSchema: z.object({ invitation: invitationSchema }), signal });
  },
  getAiProviderPolicy(organizationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/ai-provider-policy`, { outputSchema: z.object({ policy: organizationAiProviderPolicySchema }), signal });
  },
  updateAiProviderPolicy(organizationId: string, input: z.input<typeof organizationAiProviderPolicyUpdateSchema>, ifMatch: number, signal?: AbortSignal) {
    return request(`${base(organizationId)}/ai-provider-policy`, { method: "PATCH", input: organizationAiProviderPolicyUpdateSchema.parse(input), ifMatch, outputSchema: z.object({ policy: organizationAiProviderPolicySchema }), signal });
  },
};
