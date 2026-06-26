import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput, readJsonBody } from "@/src/server/api/request";
import { submitApplicabilityCheckForUser } from "@/src/server/applicability-check/service";
import { submitApplicabilityCheckSchema } from "@/src/server/applicability-check/validation";
import { organizationIdSchema } from "@/src/server/organizations/validation";

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const parsedOrganizationId = parseInput(
      organizationIdSchema,
      organizationId,
      "Invalid organizationId",
    );
    const body = await readJsonBody(request, submitApplicabilityCheckSchema);
    const result = await submitApplicabilityCheckForUser(
      user.id,
      parsedOrganizationId,
      body,
    );

    revalidatePath(
      `/tool/organizations/${parsedOrganizationId}/applicability-check`,
    );
    revalidatePath(
      `/tool/organizations/${parsedOrganizationId}/applicability-check/new`,
    );
    revalidatePath(
      `/tool/organizations/${parsedOrganizationId}/applicability-check/answers`,
    );
    revalidatePath(
      `/tool/organizations/${parsedOrganizationId}/applicability-check/result`,
    );

    return NextResponse.json({ result });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
