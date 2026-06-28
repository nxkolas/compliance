import { NextResponse } from "next/server";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import {
  getGuestApplicabilityCookieOptions,
  guestApplicabilityCookieName,
  shouldUseSecureGuestCookie,
} from "@/src/server/applicability-check/guest-cookie";
import { submitApplicabilityCheckForGuest } from "@/src/server/applicability-check/service";
import { submitApplicabilityCheckSchema } from "@/src/server/applicability-check/validation";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, submitApplicabilityCheckSchema);
    const { id, token, result } = await submitApplicabilityCheckForGuest(body);
    const resultUrl = `/check/applicability/result?check=${encodeURIComponent(id)}&claim=${encodeURIComponent(token)}`;
    const response = NextResponse.json({ result, resultUrl });

    response.cookies.set(
      guestApplicabilityCookieName,
      token,
      getGuestApplicabilityCookieOptions(shouldUseSecureGuestCookie(request)),
    );

    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    const nextResponse = NextResponse.json(response.body, {
      status: response.status,
    });
    nextResponse.cookies.delete(guestApplicabilityCookieName);
    return nextResponse;
  }
}
