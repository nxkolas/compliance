import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { submitGapQuestionnaire } from "@/src/server/gap-analysis/questionnaire-service";
import { gapQuestionnaireSubmissionSchema } from "@/src/server/gap-analysis/validation";

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(request, gapQuestionnaireSubmissionSchema);
    const revision = await submitGapQuestionnaire({ userId: user.id, organizationId, ...body });
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ revision });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
