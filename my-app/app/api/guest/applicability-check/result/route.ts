import { NextResponse } from "next/server";
import { getErrorResponse, ApiError } from "@/src/server/api/errors";
import {
  getGuestApplicabilityToken,
  getGuestApplicabilityTokenFromRequest,
  guestApplicabilityCookieName,
} from "@/src/server/applicability-check/guest-cookie";
import {
  deleteGuestApplicabilityCheck,
  getGuestApplicabilityCheck,
} from "@/src/server/applicability-check/service";

export async function GET(request: Request) {
  try {
    const token =
      (await getGuestApplicabilityToken()) ??
      getGuestApplicabilityTokenFromRequest(request);
    const guestCheck = await getGuestApplicabilityCheck(token);

    if (!guestCheck) {
      throw new ApiError(404, "Guest applicability check not found");
    }

    return NextResponse.json({ result: guestCheck.result });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(request: Request) {
  try {
    const token =
      (await getGuestApplicabilityToken()) ??
      getGuestApplicabilityTokenFromRequest(request);
    await deleteGuestApplicabilityCheck(token);
    const response = NextResponse.json({ ok: true });

    response.cookies.delete(guestApplicabilityCookieName);

    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
