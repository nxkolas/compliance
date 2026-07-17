import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import {
  getActionPlanReconciliation,
  prepareActionPlanReconciliation,
} from "@/src/server/action-plans/reconciliation-service";
import { actionPlanReconciliationPrepareSchema } from "@/src/server/gap-analysis/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const reconciliation = await getActionPlanReconciliation(
      user.id,
      organizationId,
    );
    return NextResponse.json({ reconciliation });
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
    const body = await readJsonBody(
      request,
      actionPlanReconciliationPrepareSchema,
    );
    const reconciliation = await prepareActionPlanReconciliation({
      userId: user.id,
      organizationId,
      locale: await getLocale(),
      ...body,
    });
    revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
    return NextResponse.json({ reconciliation });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
