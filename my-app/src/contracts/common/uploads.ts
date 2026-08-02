import * as z from "zod";
import { uploadSessionIdSchema } from "./ids";

export const uploadSessionStateSchema = z.enum([
  "pending",
  "uploaded",
  "completed",
  "expired",
  "failed",
]);

export const uploadSessionDtoSchema = z.object({
  id: uploadSessionIdSchema,
  state: uploadSessionStateSchema,
  fileName: z.string(),
  mimeType: z.string(),
  expectedByteSize: z.number().int().positive(),
  storageKey: z.string().min(1),
  expiresAt: z.iso.datetime(),
  uploadToken: z.string().optional(),
});

export type UploadSessionDto = z.infer<typeof uploadSessionDtoSchema>;

export const createUploadSessionRequestSchema = z
  .object({
    fileName: z.string().trim().min(1),
    mimeType: z.string().trim().min(1),
    size: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  })
  .strict();
