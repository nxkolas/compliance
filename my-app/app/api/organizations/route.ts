import { connection } from "next/server";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import { createOrganizationForUser, getOrganizationForUser, listOrganizationsForUserPage } from "@/src/server/organizations/service";
import { organizationInputSchema, organizationListQuerySchema } from "@/src/contracts/organizations";
import { runIdempotentCommand } from "@/src/server/api/idempotency";
import { databaseIdempotencyRepository } from "@/src/server/idempotency";
import { ApiError } from "@/src/server/api/errors";
import { synchronizeAuthenticatedActor } from "@/src/server/users";

export const GET = apiRoute(async ({ request }: { request: Request }) => {
  await connection();
  const user = await requireApiUser();
  const query = parseInput(organizationListQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listOrganizationsForUserPage({ userId: user.id, ...query });
  return { data: { organizations: result.organizations }, meta: { nextCursor: result.nextCursor } };
});

export const POST = apiRoute(async ({ request }) => {
  const user = await requireApiUser();
  await synchronizeAuthenticatedActor(user);
  const body = await readJsonBody(request, organizationInputSchema);
  const result = await runIdempotentCommand({
    repository: databaseIdempotencyRepository, request, actorKey: user.id, scope: "organizations", operation: "organization.create",
    requestInput: body, resultType: "organization", responseStatus: 201,
    execute: () => createOrganizationForUser(user.id, body), resultId: (organization) => organization.id,
    replay: async (id) => {
      const organization = await getOrganizationForUser(user.id, id);
      if (!organization) throw new ApiError(409, "Created organization is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE");
      return organization;
    },
  });
  return { status: 201, data: { organization: result.value, reused: result.reused } };
});
