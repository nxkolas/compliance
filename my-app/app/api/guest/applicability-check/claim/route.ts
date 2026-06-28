import { NextResponse } from "next/server";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import {
  getGuestApplicabilityToken,
  getGuestApplicabilityTokenFromRequest,
  guestApplicabilityCookieName,
} from "@/src/server/applicability-check/guest-cookie";
import { claimGuestApplicabilityCheckForUser } from "@/src/server/applicability-check/service";
import { claimGuestApplicabilityCheckSchema } from "@/src/server/applicability-check/validation";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const token =
      (await getGuestApplicabilityToken()) ??
      getGuestApplicabilityTokenFromRequest(request);
    const body = await readJsonBody(request, claimGuestApplicabilityCheckSchema);
    const result = await claimGuestApplicabilityCheckForUser(
      user.id,
      token,
      body,
    );

    const response = NextResponse.json(result);

    response.cookies.delete(guestApplicabilityCookieName);

    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
