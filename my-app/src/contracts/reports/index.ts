import * as z from "zod";
import { jobDtoSchema } from "@/src/contracts/common/jobs";

export const reportCreateSchema = z.object({ locale: z.enum(["de", "en"]) });

export const reportSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  applicabilityRevisionId: z.uuid(),
  gapRevisionId: z.uuid(),
  actionPlanId: z.uuid().nullable(),
  renderingJobId: z.uuid(),
  locale: z.enum(["de", "en"]),
  inputHash: z.string().length(64).nullable(),
  pdfHash: z.string().length(64).nullable(),
  pdfByteSize: z.number().int().positive().nullable(),
  state: z.enum(["queued", "rendering", "ready", "failed", "cancelled"]),
  createdAt: z.iso.datetime(),
});

export const reportDetailSchema = z.object({
  report: reportSchema,
  sources: z.array(z.object({ documentVersionId: z.uuid(), position: z.number().int().nonnegative() })),
  job: jobDtoSchema,
});
