import { jobIdSchema } from "@/src/contracts/common/ids";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { parseInput } from "@/src/server/api/request";
import { getAuthorizedJob } from "@/src/server/jobs";
import { enforceOperationRateLimit } from "@/src/server/api/operation-rate-limit";
import { scheduleAfterResponseDrain } from "@/src/server/job-execution/after-response";

type RouteContext = { params: Promise<{ jobId: string }> };

export const GET = apiRoute<RouteContext, { job: Awaited<ReturnType<typeof getAuthorizedJob>> }>(
  async ({ routeContext, requestId }) => {
    const user = await requireApiUser();
    await enforceOperationRateLimit({ userId: user.id, operation: "jobs:poll" });
    const { jobId } = await routeContext.params;
    const parsedJobId = parseInput(jobIdSchema, jobId, "Invalid jobId");
    const job = await getAuthorizedJob(user.id, parsedJobId);
    if (!["succeeded", "failed", "cancelled"].includes(job.state)) {
      scheduleAfterResponseDrain({ adapter: "polling", requestId });
    }
    return { data: { job } };
  },
);
