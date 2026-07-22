import * as z from "zod";
export const auditQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  eventType: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  entityId: z.uuid().optional(),
  actorUserId: z.uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: "dateFrom must be before dateTo",
  path: ["dateTo"],
});
export const auditEventSchema = z.object({ id: z.uuid(), organizationId: z.uuid(), actorUserId: z.uuid().nullable(), eventType: z.string(), entityType: z.string(), entityId: z.uuid(), metadata: z.unknown(), createdAt: z.iso.datetime() });
