import { documentSourceAccessSchema } from "@/src/contracts/documents";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { createDocumentSourceAccess } from "@/src/server/documents";

const noStoreHeaders = { "Cache-Control": "no-store" };

export const POST = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string; versionId: string }> } }) => {
  const user = await requireApiUser(); const params = await routeContext.params;
  const access = await createDocumentSourceAccess(user.id, params.organizationId, params.versionId);
  documentSourceAccessSchema.parse(access);
  return { data: { access }, headers: noStoreHeaders };
});

export const GET = apiRoute(async ({
  request,
  routeContext,
}: {
  request: Request;
  routeContext: {
    params: Promise<{ organizationId: string; versionId: string }>;
  };
}) => {
  const user = await requireApiUser();
  const params = await routeContext.params;
  const pageValue = new URL(request.url).searchParams.get("page");
  const page = pageValue ? Number(pageValue) : undefined;
  const access = await createDocumentSourceAccess(
    user.id,
    params.organizationId,
    params.versionId,
    {
      mode: "inline",
      page:
        Number.isInteger(page) && (page ?? 0) > 0 ? page : undefined,
    },
  );
  documentSourceAccessSchema.parse(access);
  return new Response(null, {
    status: 307,
    headers: {
      ...noStoreHeaders,
      Location: access.url,
    },
  });
});
