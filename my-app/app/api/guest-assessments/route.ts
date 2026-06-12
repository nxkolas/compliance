import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import {
  enforceGuestCreationRateLimit,
  requireGuestCaptchaToken,
} from "@/src/server/guest-assessments/rate-limit";
import {
  createGuestAssessment,
  guestClaimCookieName,
} from "@/src/server/guest-assessments/service";
import { createGuestAssessmentSchema } from "@/src/server/guest-assessments/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const input = await readJsonBody(request, createGuestAssessmentSchema);
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    await enforceGuestCreationRateLimit(ip);
    // Supabase consumes and verifies the Turnstile token when creating the
    // anonymous user. Re-verifying the same single-use token here would fail.
    requireGuestCaptchaToken(input.captchaToken);

    const created = await createGuestAssessment(user, input);
    const response = NextResponse.json(
      { assessmentId: created.assessment.id },
      { status: 201 },
    );
    response.cookies.set(guestClaimCookieName, created.claimToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: created.expiresAt,
    });
    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
