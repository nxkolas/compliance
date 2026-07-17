import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { retryGapReassessment } from "@/src/server/gap-analysis/reassessment-service";
import { gapReassessmentRetrySchema } from "@/src/server/gap-analysis/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(request, gapReassessmentRetrySchema);
    const result = await retryGapReassessment({
      userId: user.id,
      organizationId,
      locale: await getLocale(),
      ...body,
    });
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ result });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
