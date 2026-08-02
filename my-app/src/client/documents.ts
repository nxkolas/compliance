import * as z from "zod";
import { createClient } from "@/lib/supabase/client";
import { uploadSessionDtoSchema } from "@/src/contracts/common/uploads";
import {
  documentCountsSchema,
  documentDtoSchema,
  documentPermissionsSchema,
  type DocumentListQuery,
} from "@/src/contracts/documents";
import { request } from "./api-client";

const bucket = "organization-evidence";
const orgBase = (id: string) =>
  `/api/organizations/${encodeURIComponent(id)}`;
const documentPath = (organizationId: string, documentId: string) =>
  `${orgBase(organizationId)}/documents/${encodeURIComponent(documentId)}`;

const documentActionOutputSchema = z
  .object({ document: documentDtoSchema })
  .strict();

export const documentsClient = {
  list(
    organizationId: string,
    query: DocumentListQuery,
    signal?: AbortSignal,
  ) {
    const searchParams = new URLSearchParams({
      status: query.status,
      limit: String(query.limit),
    });
    if (query.search) searchParams.set("search", query.search);
    if (query.cursor) searchParams.set("cursor", query.cursor);
    return request(
      `${orgBase(organizationId)}/documents?${searchParams.toString()}`,
      {
        outputSchema: z
          .object({
            documents: z.array(documentDtoSchema),
            permissions: documentPermissionsSchema,
            counts: documentCountsSchema,
          })
          .strict(),
        signal,
      },
    );
  },

  async uploadNew(organizationId: string, title: string, file: File) {
    const session = await request(
      `${orgBase(organizationId)}/documents/upload-sessions`,
      {
        method: "POST",
        input: {
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        },
        outputSchema: z
          .object({ upload: uploadSessionDtoSchema })
          .strict(),
      },
    );
    await upload(session.data.upload, file);
    return request(
      `${orgBase(organizationId)}/document-upload-sessions/${session.data.upload.id}/complete`,
      {
        method: "POST",
        input: { title },
        idempotencyKey: crypto.randomUUID(),
        outputSchema: documentActionOutputSchema,
      },
    );
  },

  archive(organizationId: string, documentId: string) {
    return request(`${documentPath(organizationId, documentId)}/archive`, {
      method: "POST",
      outputSchema: documentActionOutputSchema,
    });
  },

  restore(organizationId: string, documentId: string) {
    return request(`${documentPath(organizationId, documentId)}/restore`, {
      method: "POST",
      outputSchema: documentActionOutputSchema,
    });
  },

  retryIndexing(organizationId: string, documentId: string) {
    return request(
      `${documentPath(organizationId, documentId)}/retry-indexing`,
      {
        method: "POST",
        outputSchema: documentActionOutputSchema,
      },
    );
  },

  downloadUrl(organizationId: string, documentId: string) {
    return `${documentPath(organizationId, documentId)}/download`;
  },
};

async function upload(
  session: z.infer<typeof uploadSessionDtoSchema>,
  file: File,
) {
  if (!session.uploadToken) {
    throw new Error("The upload session did not include an upload token");
  }
  const { error } = await createClient()
    .storage.from(bucket)
    .uploadToSignedUrl(session.storageKey, session.uploadToken, file, {
      contentType: file.type,
    });
  if (error) throw error;
}
