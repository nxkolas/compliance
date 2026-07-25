import { revalidatePath } from "next/cache";
import { organizationSettingsUpdateSchema } from "@/src/contracts/organizations";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/src/server/organizations/settings-service";
import { readOrganizationSettingsToken } from "@/src/server/organizations/settings-concurrency";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const settings = await getOrganizationSettings(user.id, organizationId);
  return {
    data: { settings },
    headers: { etag: `"${settings.concurrencyToken}"` },
  };
});

export const PATCH = apiRoute(async ({ request, routeContext, requestId }: { request: Request; routeContext: Context; requestId: string }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const settings = await updateOrganizationSettings({
    userId: user.id,
    organizationId,
    expected: readOrganizationSettingsToken(request),
    values: await readJsonBody(request, organizationSettingsUpdateSchema),
    requestId,
  });
  revalidatePath("/tool/organizations");
  revalidatePath(`/tool/organizations/${organizationId}`);
  revalidatePath(`/tool/organizations/${organizationId}/settings`);
  return {
    data: { settings },
    headers: { etag: `"${settings.concurrencyToken}"` },
  };
});
