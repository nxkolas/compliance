import * as z from "zod";
import {
  invitationInputSchema,
  invitationSchema,
  membershipSchema,
  memberUpdateSchema,
  organizationAiProviderPolicySchema,
  organizationAiProviderPolicyUpdateSchema,
  organizationInputSchema,
  organizationListItemSchema,
  organizationListQuerySchema,
  organizationSchema,
  organizationSettingsSchema,
  organizationSettingsUpdateSchema,
} from "@/src/contracts/organizations";
import { request } from "./api-client";

const base = (organizationId?: string) => organizationId
  ? `/api/organizations/${encodeURIComponent(organizationId)}`
  : "/api/organizations";

export const organizationsClient = {
  list(input: z.input<typeof organizationListQuerySchema>, signal?: AbortSignal) {
    const query = organizationListQuerySchema.parse(input);
    const params = new URLSearchParams({
      status: query.status,
      limit: String(query.limit),
    });
    if (query.query) params.set("query", query.query);
    if (query.cursor) params.set("cursor", query.cursor);
    return request(`${base()}?${params}`, {
      outputSchema: z.object({ organizations: z.array(organizationListItemSchema) }),
      signal,
    });
  },
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
  getSettings(organizationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/settings`, {
      outputSchema: z.object({ settings: organizationSettingsSchema }),
      signal,
    });
  },
  updateSettings(
    organizationId: string,
    input: z.input<typeof organizationSettingsUpdateSchema>,
    ifMatch: string,
    signal?: AbortSignal,
  ) {
    return request(`${base(organizationId)}/settings`, {
      method: "PATCH",
      input: organizationSettingsUpdateSchema.parse(input),
      ifMatch: `"${ifMatch}"`,
      outputSchema: z.object({ settings: organizationSettingsSchema }),
      signal,
    });
  },
  archive(organizationId: string, ifMatch: number, signal?: AbortSignal) {
    return request(`${base(organizationId)}/archive`, {
      method: "POST",
      ifMatch,
      outputSchema: z.object({ organization: organizationSchema }),
      signal,
    });
  },
  restore(organizationId: string, ifMatch: number, signal?: AbortSignal) {
    return request(`${base(organizationId)}/restore`, {
      method: "POST",
      ifMatch,
      outputSchema: z.object({ organization: organizationSchema }),
      signal,
    });
  },
  updateMember(
    organizationId: string,
    userId: string,
    input: z.input<typeof memberUpdateSchema>,
    ifMatch: number,
    signal?: AbortSignal,
  ) {
    return request(`${base(organizationId)}/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      input: memberUpdateSchema.parse(input),
      ifMatch,
      outputSchema: z.object({ member: membershipSchema }),
      signal,
    });
  },
  leave(organizationId: string, ifMatch: number, signal?: AbortSignal) {
    return request(`${base(organizationId)}/members/me/leave`, {
      method: "POST",
      ifMatch,
      outputSchema: z.object({ member: membershipSchema }),
      signal,
    });
  },
  resendInvitation(organizationId: string, invitationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/invitations/${encodeURIComponent(invitationId)}/resend`, {
      method: "POST",
      idempotencyKey: crypto.randomUUID(),
      outputSchema: z.object({ invitation: invitationSchema }),
      signal,
    });
  },
  revokeInvitation(organizationId: string, invitationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/invitations/${encodeURIComponent(invitationId)}/revoke`, {
      method: "POST",
      outputSchema: z.object({ invitation: invitationSchema }),
      signal,
    });
  },
};
