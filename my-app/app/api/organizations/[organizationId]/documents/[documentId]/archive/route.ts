import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { archiveOrganizationDocument } from "@/src/server/documents/service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; documentId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId, documentId } = await context.params;
    const document = await archiveOrganizationDocument(
      user.id,
      organizationId,
      documentId,
    );
    revalidatePath(`/tool/organizations/${organizationId}/documents`);
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ document });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
