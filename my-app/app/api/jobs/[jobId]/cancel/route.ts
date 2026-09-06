import { jobIdSchema } from "@/src/contracts/common/ids";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { parseInput } from "@/src/server/platform/http/request";
import { requestJobCancellation } from "@/src/server/platform/jobs";

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
