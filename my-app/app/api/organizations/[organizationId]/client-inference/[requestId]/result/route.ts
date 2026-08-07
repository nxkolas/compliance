import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { assertCanAccessOrganization } from "@/src/server/organizations/service";
import { clientInferenceResultSchema } from "@/src/contracts/client-inference";
import { submitClientInference } from "@/src/server/ai/client-inference/service";
import { wakeParkedJob } from "@/src/server/jobs";

type Context = {
  params: Promise<{ organizationId: string; requestId: string }>;
};

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
    await assertCanAccessOrganization(user.id, organizationId);

    const body = await readJsonBody(request, clientInferenceResultSchema);
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
