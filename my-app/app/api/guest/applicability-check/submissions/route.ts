import { NextResponse } from "next/server";
import { resolveRequestId } from "@/src/server/api/request-id";
import { ApiError } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { getGuestApplicabilityCookieOptions, guestApplicabilityCookieName, shouldUseSecureGuestCookie } from "@/src/server/applicability-check";
import { submitApplicabilityCheckForGuest } from "@/src/server/applicability-check";
import { applicabilitySubmissionSchema } from "@/src/contracts/applicability-check";
export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  try {
    const { id, token, result } = await submitApplicabilityCheckForGuest(await readJsonBody(request, applicabilitySubmissionSchema));
    const resultUrl = `/check/applicability/result?check=${encodeURIComponent(id)}&claim=${encodeURIComponent(token)}`;
    const response = NextResponse.json({ data: { result, resultUrl }, meta: { requestId } }, { headers: { "x-request-id": requestId } });
    response.cookies.set(guestApplicabilityCookieName, token, getGuestApplicabilityCookieOptions(shouldUseSecureGuestCookie(request)));
    return response;
  } catch (error) {
    const response = guestError(error, requestId); response.cookies.delete(guestApplicabilityCookieName); return response;
  }
}
function guestError(error: unknown, requestId: string) {
  const known = error instanceof ApiError ? error : new ApiError(500, "Internal server error", undefined, "INTERNAL_ERROR");
  return NextResponse.json({ error: { code: known.code, message: known.message, requestId } }, { status: known.status, headers: { "x-request-id": requestId } });
}
