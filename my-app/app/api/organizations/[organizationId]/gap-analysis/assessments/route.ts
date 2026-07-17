import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { createOrOpenGapAssessment } from "@/src/server/gap-analysis/assessment-service";

export async function POST(_: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const assessment = await createOrOpenGapAssessment(user.id, organizationId);
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ assessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
