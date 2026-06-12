import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput } from "@/src/server/api/request";
import {
  deleteGuestAssessment,
  getGuestAssessment,
  guestClaimCookieName,
} from "@/src/server/guest-assessments/service";
import { guestAssessmentIdSchema } from "@/src/server/guest-assessments/validation";
import { deleteAuthUserIfConfigured } from "@/src/server/supabase-admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { user, assessmentId, claimToken } = await requestContext(context);
    const assessment = await getGuestAssessment(
      user,
      assessmentId,
      claimToken,
    );
    return NextResponse.json({ assessment });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { user, assessmentId, claimToken } = await requestContext(context);
    const anonymousUserId = await deleteGuestAssessment(
      user,
      assessmentId,
      claimToken,
    );
    await deleteAuthUserIfConfigured(anonymousUserId);
    const response = NextResponse.json({ deleted: true });
    response.cookies.set(guestClaimCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

async function requestContext(context: RouteContext) {
  const user = await requireApiUser();
  const { assessmentId } = await context.params;
  const cookieStore = await cookies();
  return {
    user,
    assessmentId: parseInput(
      guestAssessmentIdSchema,
      assessmentId,
      "Invalid assessmentId",
    ),
    claimToken: cookieStore.get(guestClaimCookieName)?.value,
  };
}
