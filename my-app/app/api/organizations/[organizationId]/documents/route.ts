import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError, getErrorResponse } from "@/src/server/api/errors";
import {
  getOrganizationDocumentLibrary,
  uploadOrganizationDocument,
} from "@/src/server/documents/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const library = await getOrganizationDocumentLibrary(user.id, organizationId);
    return NextResponse.json({ library });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const title = form.get("title");
    if (!(file instanceof File) || typeof title !== "string") {
      throw new ApiError(400, "A document title and file are required");
    }
    const result = await uploadOrganizationDocument({
      userId: user.id,
      organizationId,
      title,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    revalidateDocumentPages(organizationId);
    return NextResponse.json({ document: result });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

function revalidateDocumentPages(organizationId: string) {
  revalidatePath(`/tool/organizations/${organizationId}/documents`);
  revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
}
