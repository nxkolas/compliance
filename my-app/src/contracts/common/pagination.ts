import * as z from "zod";

export const opaqueCursorSchema = z.string().min(1).max(2048);

export const paginationQuerySchema = z.object({
  cursor: opaqueCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
