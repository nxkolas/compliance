import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { restoreOrganization } from "@/src/server/organizations/service";
import { revalidatePath } from "next/cache";
export const POST = apiRoute(async ({ routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const organization = await restoreOrganization({ userId: user.id, organizationId });
  revalidatePath("/tool/organizations");
  revalidatePath(`/tool/organizations/${organizationId}`);
  return { data: { organization } };
});
