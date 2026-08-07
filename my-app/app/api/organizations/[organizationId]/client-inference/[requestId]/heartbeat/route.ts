import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { assertCanAccessOrganization } from "@/src/server/organizations/service";
import { heartbeatClientInference } from "@/src/server/ai/client-inference/service";

type Context = {
  params: Promise<{ organizationId: string; requestId: string }>;
};

/**
 * Extends this client's claim while its local model is still working.
 *
 * Local models are slow and Ollama serialises requests, so a single call can
 * outlast any sensible fixed lease. Heartbeating means a working tab keeps its
 * claim indefinitely while a closed one loses it in about a lease period,
 * letting another member's browser pick the work up.
 */
export const POST = apiRoute(
  async ({ routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId, requestId } = await routeContext.params;
    await assertCanAccessOrganization(user.id, organizationId);

    const row = await heartbeatClientInference({
      organizationId,
      requestId,
      userId: user.id,
    });

    return { data: { leaseExpiresAt: row.leaseExpiresAt } };
  },
);
