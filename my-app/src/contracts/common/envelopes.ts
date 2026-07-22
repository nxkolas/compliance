import * as z from "zod";

export const requestIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const apiMetaSchema = z.object({
  nextCursor: z.string().min(1).optional(),
  version: z.number().int().nonnegative().optional(),
  requestId: requestIdSchema,
});

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: requestIdSchema,
});

export const apiErrorEnvelopeSchema = z.object({
  error: apiErrorSchema,
});

export function apiSuccessEnvelopeSchema<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    meta: apiMetaSchema,
  });
}

export type ApiMeta = z.infer<typeof apiMetaSchema>;
export type ApiErrorPayload = z.infer<typeof apiErrorSchema>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
export type ApiSuccessEnvelope<T> = {
  data: T;
  meta: ApiMeta;
};
