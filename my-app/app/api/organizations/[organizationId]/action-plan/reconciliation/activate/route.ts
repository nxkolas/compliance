import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { activateActionPlanReconciliation } from "@/src/server/action-plans/reconciliation-service";
import { actionPlanReconciliationActivateSchema } from "@/src/server/gap-analysis/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(
      request,
      actionPlanReconciliationActivateSchema,
    );
    const result = await activateActionPlanReconciliation({
      userId: user.id,
      organizationId,
      ...body,
    });
    revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
    return NextResponse.json({ result });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
