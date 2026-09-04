import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { readJsonBody } from "@/src/server/platform/http/request";
import { getOrganizationForUser, updateOrganizationForUser } from "@/src/server/modules/organizations";
import { organizationInputSchema } from "@/src/contracts/organizations";
import { scheduleAfterResponseDrain } from "@/src/server/platform/jobs/execution/after-response";

type Context = { params: Promise<{ organizationId: string }> };
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const organization = await getOrganizationForUser(user.id, organizationId);
  return { data: { organization } };
});
export const PATCH = apiRoute(async ({ request, routeContext, requestId }: { request: Request; routeContext: Context; requestId: string }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const organization = await updateOrganizationForUser(user.id, organizationId, await readJsonBody(request, organizationInputSchema));
  // This route can also stage a provider change, and answers 200, so it starts
  // its own drain rather than relying on the automatic 202 wakeup.
  scheduleAfterResponseDrain({ requestId });
  revalidatePath(`/tool/organizations/${organizationId}`); revalidatePath(`/tool/organizations/${organizationId}/settings`); revalidatePath("/tool/organizations");
  return { data: { organization } };
});
