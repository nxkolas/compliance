import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import {
  guestClaimCookieName,
  saveGuestAnswers,
} from "@/src/server/guest-assessments/service";
import {
  guestAssessmentIdSchema,
  saveGuestAnswersSchema,
} from "@/src/server/guest-assessments/validation";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { assessmentId } = await context.params;
    const input = await readJsonBody(request, saveGuestAnswersSchema);
    const cookieStore = await cookies();
    const assessment = await saveGuestAnswers(
      user,
      parseInput(guestAssessmentIdSchema, assessmentId, "Invalid assessmentId"),
      input,
      cookieStore.get(guestClaimCookieName)?.value,
    );
    return NextResponse.json({ assessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
