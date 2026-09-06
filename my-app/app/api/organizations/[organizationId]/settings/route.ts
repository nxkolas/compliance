import { revalidatePath } from "next/cache";
import { organizationSettingsUpdateSchema } from "@/src/contracts/organizations";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { readJsonBody } from "@/src/server/platform/http/request";
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/src/server/modules/organizations";
import { scheduleAfterResponseDrain } from "@/src/server/platform/jobs/execution/after-response";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const settings = await getOrganizationSettings(user.id, organizationId);
  return { data: { settings } };
});

export const PATCH = apiRoute(async ({ request, routeContext, requestId }: { request: Request; routeContext: Context; requestId: string }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const settings = await updateOrganizationSettings({
    userId: user.id,
    organizationId,
    values: await readJsonBody(request, organizationSettingsUpdateSchema),
    requestId,
  });
  // Changing the AI provider enqueues a re-embedding job. This route answers
  // 200, so it does not get the automatic 202 drain and must start one itself,
  // exactly as the document-upload-complete route does.
  scheduleAfterResponseDrain({ requestId });
  revalidatePath("/tool/organizations");
  revalidatePath(`/tool/organizations/${organizationId}`);
  revalidatePath(`/tool/organizations/${organizationId}/settings`);
  return { data: { settings } };
});
