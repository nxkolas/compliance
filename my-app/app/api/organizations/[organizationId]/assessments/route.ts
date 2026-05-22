import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import {
  createSelfCheckAssessmentForOrganization,
  listSelfCheckAssessmentsForOrganization,
} from "@/src/server/organizations/service";
import {
  createSelfCheckAssessmentSchema,
  organizationIdSchema,
} from "@/src/server/organizations/validation";
import { connection, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  await connection();

  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const assessments = await listSelfCheckAssessmentsForOrganization(
      user.id,
      parseInput(organizationIdSchema, organizationId, "Invalid organizationId"),
    );

    return NextResponse.json({ assessments });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(request, createSelfCheckAssessmentSchema);
    const assessment = await createSelfCheckAssessmentForOrganization(
      user.id,
      parseInput(organizationIdSchema, organizationId, "Invalid organizationId"),
      body,
    );

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
