import { jobIdSchema } from "@/src/contracts/common/ids";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { parseInput } from "@/src/server/platform/http/request";
import { getAuthorizedJob } from "@/src/server/platform/jobs";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";

type RouteContext = { params: Promise<{ jobId: string }> };

export const GET = apiRoute<RouteContext, { job: Awaited<ReturnType<typeof getAuthorizedJob>> }>(
  async ({ routeContext }) => {
    const user = await requireApiUser();
    await enforceOperationRateLimit({ userId: user.id, operation: "jobs:poll" });
    const { jobId } = await routeContext.params;
    const parsedJobId = parseInput(jobIdSchema, jobId, "Invalid jobId");
    const job = await getAuthorizedJob(user.id, parsedJobId);
    return { data: { job } };
  },
);
