import { documentListQuerySchema } from "@/src/contracts/documents";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { parseInput } from "@/src/server/platform/http/request";
import { listOrganizationDocumentDtos } from "@/src/server/modules/documents";

export const GET = apiRoute(
  async ({
    request,
    routeContext,
  }: {
    request: Request;
    routeContext: {
      params: Promise<{ organizationId: string }>;
    };
  }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const query = parseInput(
      documentListQuerySchema,
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const result = await listOrganizationDocumentDtos({
      userId: user.id,
      organizationId,
      query,
    });
    return {
      data: {
        documents: result.documents,
        permissions: result.permissions,
        counts: result.counts,
      },
      meta: { nextCursor: result.nextCursor },
    };
  },
);
