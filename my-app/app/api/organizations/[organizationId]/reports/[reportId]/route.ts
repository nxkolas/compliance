import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { getReportDetail } from "@/src/server/modules/reports";
export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; reportId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  return { data: await getReportDetail(user.id, params.organizationId, params.reportId) };
});
