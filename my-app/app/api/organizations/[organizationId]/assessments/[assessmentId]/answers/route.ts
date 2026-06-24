import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import {
  getSelfCheckQuestionnaireForUser,
  saveSelfCheckQuestionnaireAnswers,
} from "@/src/server/organizations/service";
import {
  organizationIdSchema,
  selfCheckAssessmentIdSchema,
} from "@/src/server/organizations/validation";
import { saveGuestAnswersSchema } from "@/src/server/guest-assessments/validation";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    organizationId: string;
    assessmentId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId, assessmentId } = await context.params;
    const parsedOrganizationId = parseInput(
      organizationIdSchema,
      organizationId,
      "Invalid organizationId",
    );
    const parsedAssessmentId = parseInput(
      selfCheckAssessmentIdSchema,
      assessmentId,
      "Invalid assessmentId",
    );
    const current = await getSelfCheckQuestionnaireForUser(
      user.id,
      parsedAssessmentId,
    );

    if (current.organization.id !== parsedOrganizationId) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const input = await readJsonBody(request, saveGuestAnswersSchema);
    const assessment = await saveSelfCheckQuestionnaireAnswers(
      user.id,
      parsedAssessmentId,
      input,
    );

    return NextResponse.json({ assessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
