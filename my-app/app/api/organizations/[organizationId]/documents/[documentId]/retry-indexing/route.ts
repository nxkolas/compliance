import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { scheduleAfterResponseDrain } from "@/src/server/platform/jobs/execution/after-response";
import { retryOrganizationDocumentIndexing } from "@/src/server/modules/documents";

export const POST = apiRoute(
  async ({
    routeContext,
    requestId,
  }: {
    request: Request;
    routeContext: {
      params: Promise<{ organizationId: string; documentId: string }>;
    };
    requestId: string;
  }) => {
    const user = await requireApiUser();
    const params = await routeContext.params;
    const document = await retryOrganizationDocumentIndexing(
      user.id,
      params.organizationId,
      params.documentId,
    );
    scheduleAfterResponseDrain({ requestId });
    revalidatePath(`/tool/organizations/${params.organizationId}/documents`);
    revalidatePath(`/tool/organizations/${params.organizationId}/gap-analysis`);
    return { data: { document } };
  },
);
