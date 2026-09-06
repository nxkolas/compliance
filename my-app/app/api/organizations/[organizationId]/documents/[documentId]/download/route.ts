import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { createDocumentSourceAccess } from "@/src/server/modules/documents";

export const GET = apiRoute(
  async ({
    routeContext,
  }: {
    request: Request;
    routeContext: {
      params: Promise<{ organizationId: string; documentId: string }>;
    };
  }) => {
    const user = await requireApiUser();
    const params = await routeContext.params;
    const access = await createDocumentSourceAccess(
      user.id,
      params.organizationId,
      params.documentId,
      { mode: "download" },
    );
    return new Response(null, {
      status: 307,
      headers: {
        Location: access.url,
        "Cache-Control": "no-store",
      },
    });
  },
);
