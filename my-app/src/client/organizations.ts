import * as z from "zod";
import {
  invitationInputSchema,
  invitationSchema,
  membershipSchema,
  memberUpdateSchema,
  organizationInputSchema,
  organizationListItemSchema,
  organizationListQuerySchema,
  organizationMemberSchema,
  organizationSchema,
  organizationSettingsSchema,
  organizationSettingsUpdateSchema,
} from "@/src/contracts/organizations";
import { request } from "./api-client";

const base = (organizationId?: string) => organizationId
  ? `/api/organizations/${encodeURIComponent(organizationId)}`
  : "/api/organizations";

export const organizationsClient = {
  get(organizationId: string, signal?: AbortSignal) {
    return request(base(organizationId), {
      outputSchema: z.object({ organization: organizationSchema }),
      signal,
    });
  },
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
  listMembers(organizationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/members?limit=100`, {
      outputSchema: z.object({
        members: z.array(organizationMemberSchema),
        controls: z.object({
          actorUserId: z.uuid(),
          canManage: z.boolean(),
          canManageOwners: z.boolean(),
        }),
      }),
      signal,
    });
  },
  listInvitations(organizationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/invitations?limit=100`, {
      outputSchema: z.object({ invitations: z.array(invitationSchema) }),
      signal,
    });
  },
  create(input: z.input<typeof organizationInputSchema>, signal?: AbortSignal) {
    return request(base(), { method: "POST", input: organizationInputSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ organization: organizationSchema }), signal });
  },
  update(organizationId: string, input: z.input<typeof organizationInputSchema>, signal?: AbortSignal) {
    return request(base(organizationId), { method: "PATCH", input: organizationInputSchema.parse(input), outputSchema: z.object({ organization: organizationSchema }), signal });
  },
  invite(organizationId: string, input: z.input<typeof invitationInputSchema>, signal?: AbortSignal) {
    return request(`${base(organizationId)}/invitations`, { method: "POST", input: invitationInputSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ invitation: invitationSchema }), signal });
  },
  acceptInvitation(invitationId: string, signal?: AbortSignal) {
    return request(`/api/organization-invitations/${encodeURIComponent(invitationId)}/accept`, { method: "POST", outputSchema: z.object({ invitation: invitationSchema }), signal });
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
    signal?: AbortSignal,
  ) {
    return request(`${base(organizationId)}/settings`, {
      method: "PATCH",
      input: organizationSettingsUpdateSchema.parse(input),
      outputSchema: z.object({ settings: organizationSettingsSchema }),
      signal,
    });
  },
  archive(organizationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/archive`, {
      method: "POST",
      outputSchema: z.object({ organization: organizationSchema }),
      signal,
    });
  },
  restore(organizationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/restore`, {
      method: "POST",
      outputSchema: z.object({ organization: organizationSchema }),
      signal,
    });
  },
  updateMember(
    organizationId: string,
    userId: string,
    input: z.input<typeof memberUpdateSchema>,
    signal?: AbortSignal,
  ) {
    return request(`${base(organizationId)}/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      input: memberUpdateSchema.parse(input),
      outputSchema: z.object({ member: membershipSchema }),
      signal,
    });
  },
  removeMember(
    organizationId: string,
    userId: string,
    signal?: AbortSignal,
  ) {
    return request(`${base(organizationId)}/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      outputSchema: z.object({ member: membershipSchema }),
      signal,
    });
  },
  leave(organizationId: string, signal?: AbortSignal) {
    return request(`${base(organizationId)}/members/me/leave`, {
      method: "POST",
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
