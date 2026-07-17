import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError, getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import {
  getGapReassessmentDraft,
  prepareGapReassessment,
} from "@/src/server/gap-analysis/reassessment-service";
import { gapReassessmentPrepareSchema } from "@/src/server/gap-analysis/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const assessmentId = new URL(request.url).searchParams.get("assessmentId");
    if (!assessmentId) throw new ApiError(400, "assessmentId is required");
    const reassessment = await getGapReassessmentDraft({
      userId: user.id,
      organizationId,
      assessmentId,
      locale: await getLocale(),
    });
    return NextResponse.json({ reassessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(request, gapReassessmentPrepareSchema);
    const reassessment = await prepareGapReassessment({
      userId: user.id,
      organizationId,
      locale: await getLocale(),
      ...body,
    });
    revalidatePath(`/tool/organizations/${organizationId}/documents`);
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ reassessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
