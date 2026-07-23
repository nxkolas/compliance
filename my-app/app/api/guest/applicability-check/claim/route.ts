import { NextResponse } from "next/server";
import { resolveRequestId } from "@/src/server/api/request-id";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { getGuestApplicabilityToken, getGuestApplicabilityTokenFromRequest, guestApplicabilityCookieName } from "@/src/server/applicability-check/guest-cookie";
import { claimGuestApplicabilityCheckForUser } from "@/src/server/applicability-check/service";
import { claimGuestApplicabilityCheckSchema } from "@/src/contracts/applicability-check";
export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  try {
    const user = await requireApiUser(); const token = getGuestApplicabilityTokenFromRequest(request) ?? await getGuestApplicabilityToken();
    const body = await readJsonBody(request, claimGuestApplicabilityCheckSchema);
    const result = await claimGuestApplicabilityCheckForUser(user.id, token, body.checkId, body);
    const response = NextResponse.json({ data: { result }, meta: { requestId } }, { headers: { "x-request-id": requestId } });
    response.cookies.delete(guestApplicabilityCookieName); return response;
  } catch (error) {
    const known = error instanceof ApiError ? error : new ApiError(500, "Internal server error", undefined, "INTERNAL_ERROR");
    return NextResponse.json({ error: { code: known.code, message: known.message, requestId } }, { status: known.status, headers: { "x-request-id": requestId } });
  }
}
