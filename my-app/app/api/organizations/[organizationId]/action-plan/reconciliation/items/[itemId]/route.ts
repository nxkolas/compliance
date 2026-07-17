import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { decideActionPlanReconciliationItem } from "@/src/server/action-plans/reconciliation-service";
import { actionPlanReconciliationDecisionSchema } from "@/src/server/gap-analysis/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; itemId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId, itemId } = await context.params;
    const body = await readJsonBody(
      request,
      actionPlanReconciliationDecisionSchema,
    );
    const reconciliation = await decideActionPlanReconciliationItem({
      userId: user.id,
      organizationId,
      itemReconciliationId: itemId,
      ...body,
    });
    revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
    return NextResponse.json({ reconciliation });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
