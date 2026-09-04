import { revalidatePath } from "next/cache";
import { actionPlanItemUpdateSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { readJsonBody } from "@/src/server/platform/http/request";
import { updateActionPlanItem } from "@/src/server/modules/action-plans";
export const PATCH = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; itemId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const body = await readJsonBody(request, actionPlanItemUpdateSchema);
  const item = await updateActionPlanItem({ userId: user.id, ...params, ...body });
  revalidatePath(`/tool/organizations/${params.organizationId}/action-plan`);
  return { data: { item } };
});
