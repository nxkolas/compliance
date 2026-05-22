import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import {
  createOrganizationInvitation,
  listOrganizationInvitations,
} from "@/src/server/organizations/service";
import {
  createOrganizationInvitationSchema,
  organizationIdSchema,
} from "@/src/server/organizations/validation";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const invitations = await listOrganizationInvitations(
      user.id,
      parseInput(organizationIdSchema, organizationId, "Invalid organizationId"),
    );

    return NextResponse.json({ invitations });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(request, createOrganizationInvitationSchema);
    const invitation = await createOrganizationInvitation(
      user.id,
      parseInput(organizationIdSchema, organizationId, "Invalid organizationId"),
      body,
    );

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
