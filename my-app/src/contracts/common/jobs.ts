import * as z from "zod";
import { jobIdSchema } from "./ids";

export const jobStateSchema = z.enum([
  "queued",
  "running",
  "cancellation_requested",
  "succeeded",
  "failed",
  "cancelled",
]);

export const jobProgressPhaseSchema = z.enum([
  "preparing_evidence",
  "generating_categories",
  "validating",
  "saving_result",
  "completed",
]);

export type JobProgressPhase = z.infer<typeof jobProgressPhaseSchema>;

export const jobDtoSchema = z.object({
  id: jobIdSchema,
  kind: z.string().min(1),
  state: jobStateSchema,
  progress: z.number().int().min(0).max(100),
  phase: jobProgressPhaseSchema.nullable().default(null),
  /** True while the job is parked waiting for an organization browser to serve
   * a local model call. Progress is zero by design until a client answers. */
  waitingOnClient: z.boolean().default(false),
  completedUnits: z.number().int().nonnegative().nullable().default(null),
  totalUnits: z.number().int().nonnegative().nullable().default(null),
  attemptCount: z.number().int().nonnegative(),
  safeError: z.object({ code: z.string(), message: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  cancellable: z.boolean(),
  resultLink: z.string().nullable(),
  result: z
    .object({ actionPlanId: z.uuid() })
    .strict()
    .nullable()
    .optional(),
});

export type JobDto = z.infer<typeof jobDtoSchema>;
