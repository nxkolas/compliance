import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { enforceOperationRateLimit } from "@/src/server/api/operation-rate-limit";
import { assertCanAccessOrganization } from "@/src/server/organizations/service";
import { claimClientInference } from "@/src/server/ai/client-inference/service";

type Context = { params: Promise<{ organizationId: string }> };

/**
 * Hands this organization's next pending inference request to the caller.
 *
 * Membership is asserted before anything is read, so a client can only ever see
 * work belonging to an organization it is a member of. An organization on
 * OpenAI never produces rows here at all -- its generation runs entirely on the
 * server -- so this returns nothing for one.
 */
export const POST = apiRoute(
  async ({ routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    await enforceOperationRateLimit({
      userId: user.id,
      operation: "client-inference:claim",
      scopeId: organizationId,
    });
    await assertCanAccessOrganization(user.id, organizationId);

    const claimed = await claimClientInference({
      organizationId,
      userId: user.id,
    });

    return {
      data: {
        request: claimed
          ? {
              id: claimed.id,
              kind: claimed.kind,
              modelId: claimed.modelId,
              payload: claimed.requestPayload,
              leaseExpiresAt: claimed.leaseExpiresAt,
              attemptCount: claimed.attemptCount,
            }
          : null,
      },
    };
  },
);
