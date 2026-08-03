import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { readJsonBody } from "@/src/server/api/request";
import { getOrganizationForUser, updateOrganizationForUser } from "@/src/server/organizations/service";
import { organizationInputSchema } from "@/src/contracts/organizations";

type Context = { params: Promise<{ organizationId: string }> };
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const organization = await getOrganizationForUser(user.id, organizationId);
  return { data: { organization } };
});
export const PATCH = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const organization = await updateOrganizationForUser(user.id, organizationId, await readJsonBody(request, organizationInputSchema));
  revalidatePath(`/tool/organizations/${organizationId}`); revalidatePath(`/tool/organizations/${organizationId}/settings`); revalidatePath("/tool/organizations");
  return { data: { organization } };
});
