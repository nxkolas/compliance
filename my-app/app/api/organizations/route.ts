import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import {
  createOrganizationForUser,
  listOrganizationsForUser,
} from "@/src/server/organizations/service";
import type { CreateOrganizationInput } from "@/src/server/organizations/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireApiUser();
    const organizations = await listOrganizationsForUser(user.id);

    return NextResponse.json({ organizations });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJsonBody<CreateOrganizationInput>(request);
    const organization = await createOrganizationForUser(user.id, body);

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
