import { revalidatePath } from "next/cache";
import { actionPlanItemUpdateSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/api/auth";
import { formatEtag, requireIfMatch } from "@/src/server/api/concurrency";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { updateActionPlanItem } from "@/src/server/action-plans/service";
export const PATCH = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; itemId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const body = await readJsonBody(request, actionPlanItemUpdateSchema);
  const item = await updateActionPlanItem({ userId: user.id, ...params, ...body, expectedVersion: requireIfMatch(request) });
  revalidatePath(`/tool/organizations/${params.organizationId}/action-plan`);
  return { data: { item }, meta: { version: item!.version }, headers: { etag: formatEtag(item!.version) } };
});
