import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { createOrOpenGapAssessment, getGapAssessment } from "@/src/server/modules/gap-analysis";
import { runIdempotentCommand } from "@/src/server/platform/http/idempotency"; import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";

export const POST = apiRoute(async ({ request, routeContext }: { routeContext: { params: Promise<{ organizationId: string }> }; request: Request }) => {
  const user = await requireApiUser();
  const { organizationId } = await routeContext.params;
  const result = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, organizationId, scope: organizationId,
    operation: "gap-assessment.start", requestInput: {}, resultType: "assessment", responseStatus: 201,
    execute: () => createOrOpenGapAssessment(user.id, organizationId), resultId: (assessment) => assessment.id,
    replay: (id) => getGapAssessment(user.id, organizationId, id),
  });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { status: 201, data: { assessment: result.value, reused: result.reused } };
});
