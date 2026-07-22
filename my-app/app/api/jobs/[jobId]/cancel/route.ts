import { jobIdSchema } from "@/src/contracts/common/ids";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { parseInput } from "@/src/server/api/request";
import { requestJobCancellation } from "@/src/server/jobs/service";

type RouteContext = { params: Promise<{ jobId: string }> };

export const POST = apiRoute<RouteContext, { job: Awaited<ReturnType<typeof requestJobCancellation>> }>(
  async ({ routeContext }) => {
    const user = await requireApiUser();
    const { jobId } = await routeContext.params;
    const parsedJobId = parseInput(jobIdSchema, jobId, "Invalid jobId");
    const job = await requestJobCancellation(user.id, parsedJobId);
    return { data: { job } };
  },
);
