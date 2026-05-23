import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import { updateOrganizationForUser } from "@/src/server/organizations/service";
import {
  organizationIdSchema,
  updateOrganizationSchema,
} from "@/src/server/organizations/validation";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const parsedOrganizationId = parseInput(
      organizationIdSchema,
      organizationId,
      "Invalid organizationId",
    );
    const body = await readJsonBody(request, updateOrganizationSchema);
    const organization = await updateOrganizationForUser(
      user.id,
      parsedOrganizationId,
      body,
    );

    revalidatePath(`/tool/organizations/${parsedOrganizationId}`);
    revalidatePath(`/tool/organizations/${parsedOrganizationId}/settings`);
    revalidatePath("/tool/organizations");

    return NextResponse.json({ organization });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
