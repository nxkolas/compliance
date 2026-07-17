import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError, getErrorResponse } from "@/src/server/api/errors";
import { uploadOrganizationDocumentVersion } from "@/src/server/documents/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; documentId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId, documentId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "A document file is required");
    }
    const result = await uploadOrganizationDocumentVersion({
      userId: user.id,
      organizationId,
      documentId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    revalidatePath(`/tool/organizations/${organizationId}/documents`);
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ version: result });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
