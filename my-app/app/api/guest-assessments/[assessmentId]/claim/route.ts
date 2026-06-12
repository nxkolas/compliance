import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput } from "@/src/server/api/request";
import {
  claimGuestAssessment,
  guestClaimCookieName,
} from "@/src/server/guest-assessments/service";
import { guestAssessmentIdSchema } from "@/src/server/guest-assessments/validation";
import { deleteAuthUserIfConfigured } from "@/src/server/supabase-admin";
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
    const claimed = await claimGuestAssessment(
      user,
      parseInput(guestAssessmentIdSchema, assessmentId, "Invalid assessmentId"),
      cookieStore.get(guestClaimCookieName)?.value,
    );
    if (claimed.previousAnonymousUserId !== user.id) {
      await deleteAuthUserIfConfigured(claimed.previousAnonymousUserId);
    }
    const response = NextResponse.json({
      organizationId: claimed.organizationId,
      assessmentId: claimed.assessmentId,
    });
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
