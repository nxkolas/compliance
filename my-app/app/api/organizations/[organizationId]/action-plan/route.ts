import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { generateActionPlan } from "@/src/server/action-plans/service";
import { actionPlanGenerationRequestSchema } from "@/src/server/gap-analysis/validation";

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(request, actionPlanGenerationRequestSchema);
    const plan = await generateActionPlan({ userId: user.id, organizationId, locale: await getLocale(), ...body });
    revalidatePath(`/tool/organizations/${organizationId}/action-plan`);
    return NextResponse.json({ plan });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
