import { connection } from "next/server";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { parseInput, readJsonBody } from "@/src/server/platform/http/request";
import { createOrganizationInvitation, getOrganizationInvitation, listOrganizationInvitationsPage } from "@/src/server/modules/organizations";
import { invitationInputSchema } from "@/src/contracts/organizations";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";
import { runIdempotentCommand } from "@/src/server/platform/http/idempotency";
import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";
import type { OrganizationInvitationDto } from "@/src/server/modules/organizations";
import { paginationQuerySchema } from "@/src/contracts/common/pagination";
type Context = { params: Promise<{ organizationId: string }> };
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  await connection(); const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const query = parseInput(paginationQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listOrganizationInvitationsPage({ userId: user.id, organizationId, ...query });
  return { data: { invitations: result.invitations }, meta: { nextCursor: result.nextCursor } };
});
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "invitations:write", scopeId: organizationId });
  const body = await readJsonBody(request, invitationInputSchema);
  const result = await runIdempotentCommand<OrganizationInvitationDto>({ repository: databaseIdempotencyRepository, request, actorKey: user.id, organizationId, scope: organizationId,
    operation: "invitation.create", requestInput: body, resultType: "organization_invitation", responseStatus: 201,
    execute: () => createOrganizationInvitation(user.id, organizationId, body), resultId: (invitation) => invitation.id,
    replay: (id) => getOrganizationInvitation(user.id, organizationId, id),
  });
  return { status: 201, data: { invitation: result.value, reused: result.reused } };
});
