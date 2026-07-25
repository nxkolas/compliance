import * as z from "zod";
import { jobDtoSchema } from "@/src/contracts/common/jobs";

export const reportCreateSchema = z.object({
  kind: z.literal("compliance_summary").default("compliance_summary"),
  locale: z.enum(["de", "en"]),
});
export const reportSchema = z.object({
  id: z.uuid(), organizationId: z.uuid(), kind: z.string(), locale: z.enum(["de", "en"]),
  state: z.enum(["queued", "rendering", "ready", "failed", "cancelled"]),
  inputSnapshot: z.unknown(), inputHash: z.string(), jobId: z.uuid().nullable(),
  outputHash: z.string().length(64).nullable(), fileSize: z.number().int().nullable(), safeErrorCode: z.string().nullable(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), completedAt: z.iso.datetime().nullable(),
});
export const reportDetailSchema = z.object({
  report: reportSchema,
  sources: z.array(z.object({ sourceType: z.string(), sourceId: z.uuid() })),
  job: jobDtoSchema.nullable(),
});
