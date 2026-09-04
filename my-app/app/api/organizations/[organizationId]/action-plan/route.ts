import { revalidatePath } from "next/cache";
import { actionPlanGenerationRequestSchema } from "@/src/contracts/action-plans";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { runIdempotentCommand } from "@/src/server/platform/http/idempotency";
import { readJsonBody } from "@/src/server/platform/http/request";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";
import {
  enqueueActionPlanGeneration,
  getCurrentActionPlan,
} from "@/src/server/modules/action-plans";
import {
  getAuthorizedJob,
  toJobDto,
} from "@/src/server/platform/jobs";
import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";

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
    await enforceOperationRateLimit({
      userId: user.id,
      operation: "plans:generate",
      scopeId: organizationId,
    });
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
