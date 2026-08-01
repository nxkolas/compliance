import { revalidatePath } from "next/cache";
import { gapAnalysisEvidenceReplaceSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/api/auth";
import { requireIfMatch } from "@/src/server/api/concurrency";
import { ApiError } from "@/src/server/api/errors";
import { apiRoute } from "@/src/server/api/handler";
import { readJsonBody } from "@/src/server/api/request";
import { replaceGapAnalysisEvidence } from "@/src/server/gap-analysis";

export const PUT = apiRoute(async ({ request, routeContext }: {
  request: Request;
  routeContext: { params: Promise<{ organizationId: string; cycleId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, cycleId } = await routeContext.params;
  const body = await readJsonBody(request, gapAnalysisEvidenceReplaceSchema);
  const expectedLockVersion = requireIfMatch(request);
  if (body.expectedLockVersion !== expectedLockVersion) throw new ApiError(400, "If-Match and expectedLockVersion must agree", undefined, "PRECONDITION_MISMATCH");
  const analysisCycle = await replaceGapAnalysisEvidence({ userId: user.id, organizationId, draftId: cycleId, ...body, expectedLockVersion });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { data: { analysisCycle }, meta: { version: analysisCycle.lockVersion } };
});
