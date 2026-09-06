import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { createReportDownload } from "@/src/server/modules/reports";
export const POST = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; reportId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  return { data: { download: await createReportDownload(user.id, params.organizationId, params.reportId) } };
});
