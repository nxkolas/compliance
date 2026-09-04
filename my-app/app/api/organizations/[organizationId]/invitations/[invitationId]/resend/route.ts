import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { getOrganizationInvitation, resendOrganizationInvitation } from "@/src/server/modules/organizations";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";
import { runIdempotentCommand } from "@/src/server/platform/http/idempotency"; import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";
import type { OrganizationInvitationDto } from "@/src/server/modules/organizations";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; invitationId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "invitations:write", scopeId: params.organizationId });
  const result = await runIdempotentCommand<OrganizationInvitationDto>({ repository: databaseIdempotencyRepository, request, actorKey: user.id, organizationId: params.organizationId, scope: params.organizationId,
    operation: "invitation.resend", requestInput: params, resultType: "organization_invitation", responseStatus: 201,
    execute: () => resendOrganizationInvitation({ userId: user.id, ...params }), resultId: (invitation) => invitation.id,
    replay: (id) => getOrganizationInvitation(user.id, params.organizationId, id),
  });
  return { status: 201, data: { invitation: result.value, reused: result.reused } };
});
