import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { archiveOrganization } from "@/src/server/organizations/service";
import { revalidatePath } from "next/cache";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const organization = await archiveOrganization({ userId: user.id, organizationId });
  revalidatePath("/tool/organizations");
  revalidatePath(`/tool/organizations/${organizationId}`);
  return { data: { organization } };
});
