import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { readJsonBody } from "@/src/server/api/request";
import { getApplicabilityResultRevisionForUser, submitApplicabilityCheckForUser } from "@/src/server/applicability-check";
import { applicabilitySubmissionSchema } from "@/src/contracts/applicability-check";
import { runIdempotentCommand } from "@/src/server/api/idempotency"; import { databaseIdempotencyRepository } from "@/src/server/idempotency"; import { ApiError } from "@/src/server/api/errors";
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const body = await readJsonBody(request, applicabilitySubmissionSchema);
  const command = await runIdempotentCommand({ repository: databaseIdempotencyRepository, request, actorKey: user.id, organizationId, scope: organizationId,
    operation: "applicability.submit", requestInput: body, resultType: "generated_artifact_revision", responseStatus: 201,
    execute: () => submitApplicabilityCheckForUser(user.id, organizationId, body), resultId: (result) => result.artifactRevisionId,
    replay: async (id) => { const result = await getApplicabilityResultRevisionForUser(user.id, organizationId, id); if (!result) throw new ApiError(409, "Applicability result is unavailable", undefined, "IDEMPOTENCY_RESULT_UNAVAILABLE"); return result; },
  });
  for (const suffix of ["", "/new", "/answers", "/result"]) revalidatePath(`/tool/organizations/${organizationId}/applicability-check${suffix}`);
  return { status: 201, data: { result: command.value, reused: command.reused } };
});
