import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { restoreOrganizationDocument } from "@/src/server/modules/documents";

export const POST = apiRoute(
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
    const document = await restoreOrganizationDocument(
      user.id,
      params.organizationId,
      params.documentId,
    );
    revalidatePath(`/tool/organizations/${params.organizationId}/documents`);
    revalidatePath(`/tool/organizations/${params.organizationId}/gap-analysis`);
    return { data: { document } };
  },
);
