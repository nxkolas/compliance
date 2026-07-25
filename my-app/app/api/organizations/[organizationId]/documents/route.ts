import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { getOrganizationDocumentLibrary } from "@/src/server/documents";
import { paginationQuerySchema } from "@/src/contracts/common/pagination";
import { parseInput } from "@/src/server/api/request";
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const query = parseInput(paginationQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const library = await getOrganizationDocumentLibrary(user.id, organizationId, query);
  return { data: { library }, meta: { nextCursor: library.nextCursor } };
});
