import * as z from "zod";
import { createClient } from "@/lib/supabase/client";
import { uploadSessionDtoSchema } from "@/src/contracts/common/uploads";
import { documentUploadResultSchema } from "@/src/contracts/documents";
import { request } from "./api-client";

const bucket = "organization-evidence";
const orgBase = (id: string) => `/api/organizations/${encodeURIComponent(id)}`;

export const documentsClient = {
  async uploadNew(organizationId: string, title: string, file: File) {
    const session = await request(`${orgBase(organizationId)}/documents/upload-sessions`, {
      method: "POST", input: { fileName: file.name, mimeType: file.type, size: file.size },
      outputSchema: z.object({ upload: uploadSessionDtoSchema }),
    });
    await upload(session.data.upload, file);
    return request(`${orgBase(organizationId)}/document-upload-sessions/${session.data.upload.id}/complete`, {
      method: "POST", input: { title }, idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ document: documentUploadResultSchema }),
    });
  },
  async uploadVersion(organizationId: string, documentId: string, file: File) {
    const session = await request(`${orgBase(organizationId)}/documents/${encodeURIComponent(documentId)}/version-upload-sessions`, {
      method: "POST", input: { fileName: file.name, mimeType: file.type, size: file.size },
      outputSchema: z.object({ upload: uploadSessionDtoSchema }),
    });
    await upload(session.data.upload, file);
    return request(`${orgBase(organizationId)}/document-upload-sessions/${session.data.upload.id}/complete`, {
      method: "POST", input: { documentId }, idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ document: documentUploadResultSchema }),
    });
  },
  archive(organizationId: string, documentId: string, version: number) {
    return request(`${orgBase(organizationId)}/documents/${encodeURIComponent(documentId)}/archive`, {
      method: "POST", ifMatch: version, outputSchema: z.object({ document: z.object({ id: z.uuid() }).loose() }),
    });
  },
  restore(organizationId: string, documentId: string, version: number) {
    return request(`${orgBase(organizationId)}/documents/${encodeURIComponent(documentId)}/restore`, {
      method: "POST", ifMatch: version, outputSchema: z.object({ document: z.object({ id: z.uuid() }).loose() }),
    });
  },
};

async function upload(session: z.infer<typeof uploadSessionDtoSchema>, file: File) {
  if (!session.uploadToken) throw new Error("The upload session did not include an upload token");
  const { error } = await createClient().storage.from(bucket).uploadToSignedUrl(session.objectPath, session.uploadToken, file, { contentType: file.type });
  if (error) throw error;
}
