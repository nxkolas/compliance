import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput } from "@/src/server/api/request";
import { getSelfCheckQuestionnaireForUser } from "@/src/server/organizations/service";
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId, assessmentId } = await context.params;
    const parsedOrganizationId = parseInput(
      organizationIdSchema,
      organizationId,
      "Invalid organizationId",
    );
    const assessment = await getSelfCheckQuestionnaireForUser(
      user.id,
      parseInput(
        selfCheckAssessmentIdSchema,
        assessmentId,
        "Invalid assessmentId",
      ),
    );

    if (assessment.organization.id !== parsedOrganizationId) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    return NextResponse.json({ assessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
