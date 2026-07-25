import { revalidatePath } from "next/cache";
import { organizationAiProviderPolicyUpdateSchema } from "@/src/contracts/organizations";
import { requireApiUser } from "@/src/server/api/auth";
import { formatEtag, requireIfMatch } from "@/src/server/api/concurrency";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { getOrganizationAiProviderPolicy, updateOrganizationAiProviderPolicy } from "@/src/server/organizations/ai-provider-policy-service";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(async ({ routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const policy = await getOrganizationAiProviderPolicy(user.id, organizationId);
  return { data: { policy }, meta: { version: policy.version }, headers: { etag: formatEtag(policy.version) } };
});

export const PATCH = apiRoute(async ({ request, requestId, routeContext }: { request: Request; requestId: string; routeContext: Context }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const policy = await updateOrganizationAiProviderPolicy({
    userId: user.id,
    organizationId,
    expectedVersion: requireIfMatch(request),
    requestId,
    ...await readJsonBody(request, organizationAiProviderPolicyUpdateSchema),
  });
  revalidatePath(`/tool/organizations/${organizationId}/settings`);
  return { data: { policy }, meta: { version: policy.version }, headers: { etag: formatEtag(policy.version) } };
});
