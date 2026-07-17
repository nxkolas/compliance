import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { updateGapReassessmentEvidence } from "@/src/server/gap-analysis/reassessment-service";
import { gapReassessmentEvidenceSchema } from "@/src/server/gap-analysis/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(request, gapReassessmentEvidenceSchema);
    const draft = await updateGapReassessmentEvidence({
      userId: user.id,
      organizationId,
      ...body,
    });
    revalidatePath(`/tool/organizations/${organizationId}/documents`);
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ draft });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
