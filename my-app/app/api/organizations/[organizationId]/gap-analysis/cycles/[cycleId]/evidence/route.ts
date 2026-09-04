import { revalidatePath } from "next/cache";
import { gapAnalysisEvidenceReplaceSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { readJsonBody } from "@/src/server/platform/http/request";
import { replaceGapAnalysisEvidence } from "@/src/server/modules/gap-analysis";

export const PUT = apiRoute(async ({ request, routeContext }: {
  request: Request;
  routeContext: { params: Promise<{ organizationId: string; cycleId: string }> };
}) => {
  const user = await requireApiUser();
  const { organizationId, cycleId } = await routeContext.params;
  const body = await readJsonBody(request, gapAnalysisEvidenceReplaceSchema);
  const analysisCycle = await replaceGapAnalysisEvidence({ userId: user.id, organizationId, draftId: cycleId, ...body });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { data: { analysisCycle } };
});
