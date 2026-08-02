import { revalidatePath } from "next/cache";
import { gapAnalysisEvidenceReplaceSchema } from "@/src/contracts/gap-analysis/generation";
import { requireApiUser } from "@/src/server/api/auth";
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
  const analysisCycle = await replaceGapAnalysisEvidence({ userId: user.id, organizationId, draftId: cycleId, ...body });
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
  return { data: { analysisCycle } };
});
