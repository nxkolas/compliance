import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { formatEtag, requireIfMatch } from "@/src/server/api/concurrency";
import { ApiError } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { getOrganizationForUser, updateOrganizationForUser } from "@/src/server/organizations/service";
import { organizationInputSchema } from "@/src/contracts/organizations";

type Context = { params: Promise<{ organizationId: string }> };
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const organization = await getOrganizationForUser(user.id, organizationId);
  if (!organization) throw new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
  return { data: { organization }, meta: { version: organization.version }, headers: { etag: formatEtag(organization.version) } };
});
export const PATCH = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const organization = await updateOrganizationForUser(user.id, organizationId, await readJsonBody(request, organizationInputSchema), requireIfMatch(request));
  revalidatePath(`/tool/organizations/${organizationId}`); revalidatePath(`/tool/organizations/${organizationId}/settings`); revalidatePath("/tool/organizations");
  return { data: { organization }, meta: { version: organization.version }, headers: { etag: formatEtag(organization.version) } };
});
