import { revalidatePath } from "next/cache";
import { apiRoute } from "@/src/server/api/handler";
import { requireApiUser } from "@/src/server/api/auth";
import { readJsonBody } from "@/src/server/api/request";
import { updateGapReassessmentEvidence } from "@/src/server/gap-analysis/reassessment-service";
import { gapReassessmentEvidenceSchema } from "@/src/contracts/gap-analysis/generation";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { ApiError } from "@/src/server/api/errors";
export const PATCH = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: { params: Promise<{ organizationId: string }> } }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const body = await readJsonBody(request, gapReassessmentEvidenceSchema); const expectedLockVersion = requireIfMatch(request);
  if (body.expectedLockVersion !== expectedLockVersion) throw new ApiError(400, "If-Match and expectedLockVersion must agree", undefined, "PRECONDITION_MISMATCH");
  const draft = await updateGapReassessmentEvidence({ userId: user.id, organizationId, ...body, expectedLockVersion });
  revalidatePath(`/tool/organizations/${organizationId}/documents`); revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { data: { draft }, meta: { version: draft.lockVersion } };
});
