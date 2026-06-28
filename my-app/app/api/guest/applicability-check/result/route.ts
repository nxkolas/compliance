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
import { guestApplicabilityCheckReferenceSchema } from "@/src/server/applicability-check/validation";

export async function GET(request: Request) {
  try {
    const token =
      getGuestApplicabilityTokenFromRequest(request) ??
      (await getGuestApplicabilityToken());
    const checkId = guestApplicabilityCheckReferenceSchema.parse({
      checkId: new URL(request.url).searchParams.get("check") ?? undefined,
    }).checkId;
    const guestCheck = await getGuestApplicabilityCheck(token, checkId);

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
      getGuestApplicabilityTokenFromRequest(request) ??
      (await getGuestApplicabilityToken());
    const body = (await request.json().catch(() => null)) as unknown;
    const checkId = guestApplicabilityCheckReferenceSchema.parse({
      checkId:
        typeof body === "object" && body !== null && "checkId" in body
          ? (body as { checkId: unknown }).checkId
          : new URL(request.url).searchParams.get("check") ?? undefined,
    }).checkId;

    await deleteGuestApplicabilityCheck(token, checkId);
    const response = NextResponse.json({ ok: true });

    response.cookies.delete(guestApplicabilityCookieName);

    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
