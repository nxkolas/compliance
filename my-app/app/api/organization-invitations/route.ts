import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { listMailboxInvitationsForUser } from "@/src/server/organizations/service";
import { connection, NextResponse } from "next/server";

export async function GET() {
  await connection();

  try {
    const user = await requireApiUser();
    const invitations = await listMailboxInvitationsForUser(user);

    return NextResponse.json({ invitations });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
