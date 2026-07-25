import * as z from "zod";
export const documentUploadCompletionSchema = z.object({ title: z.string().trim().min(1).optional(), documentId: z.uuid().optional() });
export const documentUploadResultSchema = z.object({
  documentId: z.uuid(), documentVersionId: z.uuid(), versionNumber: z.number().int().positive().optional(),
  extractionId: z.uuid().optional(), embeddingGenerationId: z.uuid().optional(), replayed: z.boolean(),
});
export const documentEntitySchema = z.object({ id: z.uuid() }).loose();
export const documentUpdateSchema = z.object({ title: z.string().trim().min(1).max(255) });
export const documentSourceAccessSchema = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
