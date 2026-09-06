import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { ApiError } from "@/src/server/platform/http/errors";
import { getOrganizationDocumentDetail } from "@/src/server/modules/documents";

type Context = {
  params: Promise<{ organizationId: string; documentId: string }>;
};

export const GET = apiRoute(
  async ({
    routeContext,
  }: {
    request: Request;
    routeContext: Context;
  }) => {
    const user = await requireApiUser();
    const params = await routeContext.params;
    const document = await getOrganizationDocumentDetail(
      user.id,
      params.organizationId,
      params.documentId,
    );
    if (!document) {
      throw new ApiError(
        404,
        "Document not found",
        undefined,
        "DOCUMENT_NOT_FOUND",
      );
    }
    return { data: { document } };
  },
);
