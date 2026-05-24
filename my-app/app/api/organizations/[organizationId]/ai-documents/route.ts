import { createClient } from "@/lib/supabase/server";
import {
  ensureAiChat,
  ingestAiDocument,
  listChatAiDocuments,
} from "@/lib/ai/rag";
import { requireApiUser } from "@/src/server/api/auth";
import { ApiError, getErrorResponse } from "@/src/server/api/errors";
import { parseInput } from "@/src/server/api/request";
import { getOrganizationForUser } from "@/src/server/organizations/service";
import { NextResponse } from "next/server";
import * as z from "zod";

const bucketName =
  process.env.AI_DOCUMENTS_BUCKET ?? "organization-ai-documents";

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const parsedOrganizationId = parseInput(
      z.uuid(),
      organizationId,
      "Invalid organizationId",
    );
    const organization = await getOrganizationForUser(user.id, parsedOrganizationId);

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    const chatId = parseInput(
      z.uuid(),
      new URL(request.url).searchParams.get("chatId"),
      "Invalid chatId",
    );
    const documents = await listChatAiDocuments({
      chatId,
      organizationId: parsedOrganizationId,
    });

    return NextResponse.json({
      documents: documents.map((document) => ({
        id: document.id,
        title: document.title,
        status: document.status,
        mimeType: document.mimeType,
        errorMessage: document.errorMessage,
        createdAt: document.createdAt,
      })),
    });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const parsedOrganizationId = parseInput(
      z.uuid(),
      organizationId,
      "Invalid organizationId",
    );
    const organization = await getOrganizationForUser(user.id, parsedOrganizationId);

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    const formData = await request.formData();
    const chatId = parseInput(
      z.uuid(),
      formData.get("chatId"),
      "Invalid chatId",
    );
    const messageId = parseOptionalString(formData.get("messageId"));
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "file is required");
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new ApiError(400, "Files must be 20 MB or smaller");
    }

    await ensureAiChat({
      chatId,
      organizationId: parsedOrganizationId,
      userId: user.id,
      title: "Compliance assistant",
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const documentId = crypto.randomUUID();
    const storagePath = `${parsedOrganizationId}/${documentId}/${sanitizeFileName(
      file.name,
    )}`;
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new ApiError(500, uploadError.message);
    }

    const document = await ingestAiDocument({
      chatId,
      uiMessageId: messageId,
      organizationId: parsedOrganizationId,
      userId: user.id,
      title: file.name,
      storagePath,
      mimeType: file.type || null,
      buffer,
      scope: "organization",
      metadata: {
        originalFileName: file.name,
        size: file.size,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
