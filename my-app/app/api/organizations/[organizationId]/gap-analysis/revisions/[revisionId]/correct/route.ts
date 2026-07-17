import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { correctGapRevision } from "@/src/server/gap-analysis/review-service";
import { gapCorrectionRequestSchema } from "@/src/server/gap-analysis/validation";

export async function POST(request: Request, context: { params: Promise<{ organizationId: string; revisionId: string }> }) {
  try {
    const user = await requireApiUser();
    const { organizationId, revisionId } = await context.params;
    const body = await readJsonBody(request, gapCorrectionRequestSchema);
    const revision = await correctGapRevision({ userId: user.id, organizationId, sourceRevisionId: revisionId, ...body });
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ revision });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
