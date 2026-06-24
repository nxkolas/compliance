import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput } from "@/src/server/api/request";
import {
  completeGuestAssessment,
  guestClaimCookieName,
} from "@/src/server/guest-assessments/service";
import { guestAssessmentIdSchema } from "@/src/server/guest-assessments/validation";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { assessmentId } = await context.params;
    const cookieStore = await cookies();
    const assessment = await completeGuestAssessment(
      user,
      parseInput(guestAssessmentIdSchema, assessmentId, "Invalid assessmentId"),
      cookieStore.get(guestClaimCookieName)?.value,
    );
    return NextResponse.json({ assessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
