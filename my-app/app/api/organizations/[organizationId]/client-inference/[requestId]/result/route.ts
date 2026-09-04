import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";
import { readJsonBody } from "@/src/server/platform/http/request";
import { assertCanAccessOrganization } from "@/src/server/modules/organizations";
import { clientInferenceResultSchema } from "@/src/contracts/client-inference";
import { submitClientInference } from "@/src/server/platform/ai/client-inference/service";
import { wakeParkedJob } from "@/src/server/platform/jobs";

type Context = {
  params: Promise<{ organizationId: string; requestId: string }>;
};

/**
 * A relayed embedding batch at the maximum configured dimensions can serialize
 * to tens of megabytes, so the result cap is larger than the default body cap.
 * It still bounds what a client can store on a request row.
 */
const MAX_RESULT_BODY_BYTES = 32 * 1024 * 1024;

/**
 * Records what a client's local model returned and wakes the parked job.
 *
 * Answering 202 is load-bearing: `apiRoute` schedules an after-response job
 * drain on that status, and that drain is what resumes the job. The job then
 * re-executes, reaches this same inference call, finds the stored answer by
 * input hash, and continues past it.
 *
 * Nothing here judges the output. `submitClientInference` stores it verbatim;
 * the grounding gateway revalidates every claim against server-held context
 * when the job resumes, so a client that tampers with the response causes a
 * validation failure rather than a fabricated finding.
 */
export const POST = apiRoute(
  async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
    const user = await requireApiUser();
    const { organizationId, requestId } = await routeContext.params;
    await enforceOperationRateLimit({
      userId: user.id,
      operation: "client-inference:result",
      scopeId: organizationId,
    });
    await assertCanAccessOrganization(user.id, organizationId);

    const body = await readJsonBody(request, clientInferenceResultSchema, {
      maxBytes: MAX_RESULT_BODY_BYTES,
    });
    const row = await submitClientInference({
      organizationId,
      requestId,
      userId: user.id,
      response: body.output,
      reportedModelId: body.reportedModelId ?? null,
      attestedUsage: body.attestedUsage ?? null,
    });
    // The parked job's availableAt sits at the lease horizon; move it to now so
    // this request's after-response drain resumes it immediately.
    if (row.jobId) {
      await wakeParkedJob({ jobId: row.jobId });
    }

    return { status: 202, data: { accepted: true } };
  },
);
