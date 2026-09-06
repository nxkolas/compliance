import { connection } from "next/server";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { parseInput, readJsonBody } from "@/src/server/platform/http/request";
import { createOrganizationForUser, getOrganizationForUser, listOrganizationsForUserPage } from "@/src/server/modules/organizations";
import { organizationInputSchema, organizationListQuerySchema } from "@/src/contracts/organizations";
import { runIdempotentCommand } from "@/src/server/platform/http/idempotency";
import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";
import { ApiError } from "@/src/server/platform/http/errors";
import { synchronizeAuthenticatedActor } from "@/src/server/platform/auth/user-directory";
import { revalidatePath } from "next/cache";

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
  revalidatePath("/");
  return { status: 201, data: { organization: result.value, reused: result.reused } };
});
