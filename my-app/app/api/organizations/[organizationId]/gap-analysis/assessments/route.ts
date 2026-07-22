import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { createOrOpenGapAssessment, getGapAssessment } from "@/src/server/gap-analysis/assessment-service";
import { runIdempotentCommand } from "@/src/server/api/idempotency"; import { databaseIdempotencyRepository } from "@/src/server/idempotency/repository";

export const POST = apiRoute(async ({ request, routeContext }: { routeContext: { params: Promise<{ organizationId: string }> }; request: Request }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const result = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, scope: organizationId,
    operation: "gap-assessment.start", requestInput: {}, resultType: "assessment", responseStatus: 201,
    execute: () => createOrOpenGapAssessment(user.id, organizationId), resultId: (assessment) => assessment.id,
    replay: (id) => getGapAssessment(user.id, organizationId, id),
  });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { status: 201, data: { assessment: result.value, reused: result.reused } };
});
