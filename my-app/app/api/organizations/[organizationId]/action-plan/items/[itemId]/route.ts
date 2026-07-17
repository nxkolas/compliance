import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { updateActionPlanItem } from "@/src/server/action-plans/service";
import { actionPlanItemUpdateSchema } from "@/src/server/gap-analysis/validation";

export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string; itemId: string }> }) {
  try {
    const user = await requireApiUser();
    const { organizationId, itemId } = await context.params;
    const body = await readJsonBody(request, actionPlanItemUpdateSchema);
    const item = await updateActionPlanItem({ userId: user.id, organizationId, itemId, ...body });
    revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
    return NextResponse.json({ item });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
