import { revalidatePath } from "next/cache";
import { actionPlanGenerationRequestSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { runIdempotentCommand } from "@/src/server/api/idempotency";
import { readJsonBody } from "@/src/server/api/request";
import {
  enqueueActionPlanGeneration,
  getCurrentActionPlan,
} from "@/src/server/action-plans";
import {
  getAuthorizedJob,
  toJobDto,
} from "@/src/server/jobs";
import { databaseIdempotencyRepository } from "@/src/server/idempotency";

type Context = { params: Promise<{ organizationId: string }> };

export const GET = apiRoute(
  async ({
    routeContext,
  }: {
    request: Request;
    routeContext: Context;
  }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const current = await getCurrentActionPlan(user.id, organizationId);
    return { data: { current } };
  },
);

export const POST = apiRoute(
  async ({
    request,
    routeContext,
  }: {
    request: Request;
    routeContext: Context;
  }) => {
    const user = await requireApiUser();
    const { organizationId } = await routeContext.params;
    const body = await readJsonBody(
      request,
      actionPlanGenerationRequestSchema,
    );
    const result = await runIdempotentCommand({
      repository: databaseIdempotencyRepository,
      request,
      actorKey: user.id,
      scope: organizationId,
      operation: "action-plan.generate",
      requestInput: body,
      resultType: "background_job",
      responseStatus: 202,
      execute: async () =>
        toJobDto(
          await enqueueActionPlanGeneration({
            userId: user.id,
            organizationId,
            sourceGapRevisionId: body.gapRevisionId,
          }),
        ),
      resultId: (job) => job.id,
      replay: (jobId) => getAuthorizedJob(user.id, jobId),
    });
    revalidatePath(
      `/tool/organizations/${organizationId}/gap-analysis`,
    );
    return {
      status: 202,
      data: { job: result.value, reused: result.reused },
    };
  },
);
