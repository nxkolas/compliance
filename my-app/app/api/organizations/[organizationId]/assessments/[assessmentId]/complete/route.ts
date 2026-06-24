import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput } from "@/src/server/api/request";
import {
  completeSelfCheckQuestionnaire,
  getSelfCheckQuestionnaireForUser,
} from "@/src/server/organizations/service";
import {
  organizationIdSchema,
  selfCheckAssessmentIdSchema,
} from "@/src/server/organizations/validation";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    organizationId: string;
    assessmentId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
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

    const assessment = await completeSelfCheckQuestionnaire(
      user.id,
      parsedAssessmentId,
    );

    return NextResponse.json({ assessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
