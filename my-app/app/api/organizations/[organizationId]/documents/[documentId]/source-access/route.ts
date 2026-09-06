import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { createDocumentSourceAccess } from "@/src/server/modules/documents";

export const GET = apiRoute(
  async ({
    request,
    routeContext,
  }: {
    request: Request;
    routeContext: {
      params: Promise<{ organizationId: string; documentId: string }>;
    };
  }) => {
    const user = await requireApiUser();
    const params = await routeContext.params;
    const rawPage = new URL(request.url).searchParams.get("page");
    const parsedPage = rawPage ? Number(rawPage) : undefined;
    const page =
      Number.isInteger(parsedPage) && (parsedPage ?? 0) > 0
        ? parsedPage
        : undefined;
    const access = await createDocumentSourceAccess(
      user.id,
      params.organizationId,
      params.documentId,
      { mode: "inline", page },
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
