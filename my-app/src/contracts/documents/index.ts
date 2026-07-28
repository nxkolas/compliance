import * as z from "zod";
import { opaqueCursorSchema } from "@/src/contracts/common/pagination";

export const documentStatusSchema = z.enum(["active", "archived"]);
export const documentIndexStatusSchema = z.enum([
  "processing",
  "indexed",
  "failed",
]);

export const documentDtoSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    mimeType: z.string().min(1),
    byteSize: z.number().int().positive(),
    uploadedAt: z.iso.datetime(),
    status: documentStatusSchema,
    indexStatus: documentIndexStatusSchema,
  })
  .strict();

export const documentPermissionsSchema = z
  .object({
    canUpload: z.boolean(),
    canArchive: z.boolean(),
    canRestore: z.boolean(),
    canRetryIndexing: z.boolean(),
  })
  .strict();

export const documentCountsSchema = z
  .object({
    all: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    archived: z.number().int().nonnegative(),
  })
  .strict();

export const documentListStatusSchema = z.enum(["active", "archived", "all"]);

export const documentListQuerySchema = z
  .object({
    status: documentListStatusSchema.default("active"),
    search: z.string().trim().max(200).optional(),
    cursor: opaqueCursorSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
  .transform((query) => ({
    ...query,
    search: query.search || undefined,
  }));

export const documentListResponseSchema = z
  .object({
    data: z
      .object({
        documents: z.array(documentDtoSchema),
        permissions: documentPermissionsSchema,
        counts: documentCountsSchema,
      })
      .strict(),
    meta: z
      .object({
        nextCursor: opaqueCursorSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const documentDetailResponseSchema = z
  .object({
    data: z.object({ document: documentDtoSchema }).strict(),
  })
  .strict();

export const documentUploadCompletionSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
  })
  .strict();

export const documentActionResponseSchema = z
  .object({
    data: z.object({ document: documentDtoSchema }).strict(),
  })
  .strict();

export type DocumentDto = z.infer<typeof documentDtoSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
