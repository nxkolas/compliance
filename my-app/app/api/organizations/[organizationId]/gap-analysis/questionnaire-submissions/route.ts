import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/src/server/platform/http/auth"; import { apiRoute } from "@/src/server/platform/http/handler"; import { runIdempotentCommand } from "@/src/server/platform/http/idempotency"; import { readJsonBody } from "@/src/server/platform/http/request";
import { getGapQuestionnaireRevision, submitGapQuestionnaire } from "@/src/server/modules/gap-analysis"; import { gapQuestionnaireInputSchema as gapQuestionnaireSubmissionSchema } from "@/src/contracts/gap-analysis/generation"; import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params; const body = await readJsonBody(request, gapQuestionnaireSubmissionSchema);
  const result = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, organizationId, scope: organizationId,
    operation: "gap-questionnaire.submit", requestInput: body, resultType: "assessment_revision", responseStatus: 201,
    execute: () => submitGapQuestionnaire({ userId: user.id, organizationId, ...body }), resultId: (revision) => revision.id,
    replay: (id) => getGapQuestionnaireRevision(user.id, organizationId, id),
  });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { status: 201, data: { revision: result.value, reused: result.reused } };
});
