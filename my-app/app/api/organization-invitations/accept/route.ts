import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { acceptOrganizationInvitation } from "@/src/server/organizations/service";
import { acceptOrganizationInvitationSchema } from "@/src/server/organizations/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJsonBody(request, acceptOrganizationInvitationSchema);
    const invitation = await acceptOrganizationInvitation(user, body);

    return NextResponse.json({ invitation });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
