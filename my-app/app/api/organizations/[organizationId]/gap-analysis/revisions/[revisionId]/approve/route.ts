import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { approveGapRevision } from "@/src/server/gap-analysis/review-service";

export async function POST(_: Request, context: { params: Promise<{ organizationId: string; revisionId: string }> }) {
  try {
    const user = await requireApiUser();
    const { organizationId, revisionId } = await context.params;
    const revision = await approveGapRevision({ userId: user.id, organizationId, revisionId });
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
    return NextResponse.json({ revision });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
