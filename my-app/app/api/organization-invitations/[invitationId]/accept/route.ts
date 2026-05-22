import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput } from "@/src/server/api/request";
import { acceptMailboxInvitation } from "@/src/server/organizations/service";
import { invitationIdSchema } from "@/src/server/organizations/validation";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    invitationId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { invitationId } = await context.params;
    const invitation = await acceptMailboxInvitation(
      user,
      parseInput(invitationIdSchema, invitationId, "Invalid invitationId"),
    );

    return NextResponse.json({ invitation });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
