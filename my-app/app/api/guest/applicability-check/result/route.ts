import { NextResponse } from "next/server";
import { apiRoute } from "@/src/server/platform/http/handler";
import { resolveRequestId } from "@/src/server/platform/http/request-id";
import { ApiError } from "@/src/server/platform/http/errors";
import { getGuestApplicabilityToken, getGuestApplicabilityTokenFromRequest, guestApplicabilityCookieName } from "@/src/server/modules/applicability-check";
import { deleteGuestApplicabilityCheck, getGuestApplicabilityCheck } from "@/src/server/modules/applicability-check";
import { guestApplicabilityCheckReferenceSchema } from "@/src/contracts/applicability-check";
import { parseInput, readOptionalJsonBody } from "@/src/server/platform/http/request";
export const GET = apiRoute(async ({ request }) => {
  const token = getGuestApplicabilityTokenFromRequest(request) ?? await getGuestApplicabilityToken();
  const checkId = parseInput(guestApplicabilityCheckReferenceSchema, { checkId: new URL(request.url).searchParams.get("check") ?? undefined }).checkId;
  const guestCheck = await getGuestApplicabilityCheck(token, checkId);
  if (!guestCheck) throw new ApiError(404, "Guest applicability check not found", undefined, "GUEST_CHECK_NOT_FOUND");
  return { data: { result: guestCheck.result } };
});
export async function DELETE(request: Request) {
  const requestId = resolveRequestId(request);
  try {
    const token = getGuestApplicabilityTokenFromRequest(request) ?? await getGuestApplicabilityToken();
    const body = await readOptionalJsonBody(request, guestApplicabilityCheckReferenceSchema);
    const checkId = parseInput(guestApplicabilityCheckReferenceSchema, { checkId: body.checkId ?? new URL(request.url).searchParams.get("check") ?? undefined }).checkId;
    await deleteGuestApplicabilityCheck(token, checkId);
    const response = NextResponse.json({ data: { ok: true }, meta: { requestId } }, { headers: { "x-request-id": requestId } });
    response.cookies.delete(guestApplicabilityCookieName); return response;
  } catch (error) {
    const known = error instanceof ApiError ? error : new ApiError(500, "Internal server error", undefined, "INTERNAL_ERROR");
    return NextResponse.json({ error: { code: known.code, message: known.message, requestId } }, { status: known.status, headers: { "x-request-id": requestId } });
  }
}
