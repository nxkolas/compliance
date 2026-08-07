import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { enforceOperationRateLimit } from "@/src/server/api/operation-rate-limit";
import { readJsonBody } from "@/src/server/api/request";
import { assertCanAccessOrganization } from "@/src/server/organizations/service";
import { clientInferenceFailureSchema } from "@/src/contracts/client-inference";
import { failClientInference } from "@/src/server/ai/client-inference/service";
import { wakeParkedJob } from "@/src/server/jobs";

type Context = {
  params: Promise<{ organizationId: string; requestId: string }>;
};

const MAX_FAILURE_BODY_BYTES = 16 * 1024;

/**
 * Records that a client could not run the request, so the parked job fails with
 * a reason instead of waiting for the request to expire.
 *
 * Answers 202 so the after-response drain wakes the job promptly: the point of
 * reporting a failure is to stop waiting, and that only helps if the job finds
 * out now rather than at the expiry sweep.
 */
export const POST = apiRoute(
  async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId, requestId } = await routeContext.params;
    await enforceOperationRateLimit({
      userId: user.id,
      operation: "client-inference:failure",
      scopeId: organizationId,
    });
    await assertCanAccessOrganization(user.id, organizationId);

    const body = await readJsonBody(request, clientInferenceFailureSchema, {
      maxBytes: MAX_FAILURE_BODY_BYTES,
    });
    const row = await failClientInference({
      organizationId,
      requestId,
      userId: user.id,
      failureCode: body.failureCode,
      failureMessage: body.failureMessage,
    });
    // Same as the result route: reporting a failure should let the job find out
    // now rather than at the lease horizon.
    if (row.jobId) {
      await wakeParkedJob({ jobId: row.jobId });
    }

    return { status: 202, data: { accepted: true } };
  },
);
