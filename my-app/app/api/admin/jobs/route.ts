import { platformJobsQuerySchema } from "@/src/contracts/admin";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { parseInput } from "@/src/server/api/request";
import { listPlatformJobs } from "@/src/server/admin/operations-service";
export const GET = apiRoute(async ({ request }: { request: Request }) => {
  const user = await requireApiUser();
  const query = parseInput(platformJobsQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listPlatformJobs({ userId: user.id, ...query });
  return { data: { jobs: result.jobs }, meta: { nextCursor: result.nextCursor } };
});
