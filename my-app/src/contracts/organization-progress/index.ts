import * as z from "zod";

export const organizationProgressStepKeys = [
  "welcome",
  "applicability_check",
  "gap_analysis",
  "documents_uploaded",
  "action_plan",
  "next_steps",
] as const;

export const organizationProgressStepKeySchema = z.enum(
  organizationProgressStepKeys,
);

export const organizationProgressStepStatusSchema = z.enum([
  "completed",
  "current",
  "upcoming",
  "not_applicable",
]);

export const organizationProgressStepSchema = z.object({
  key: organizationProgressStepKeySchema,
  status: organizationProgressStepStatusSchema,
});

export const organizationProgressSchema = z.object({
  currentStep: organizationProgressStepKeySchema.nullable(),
  completedCount: z.number().int().min(0).max(6),
  totalCount: z.union([z.literal(2), z.literal(6)]),
  steps: z.tuple([
    organizationProgressStepSchema.extend({ key: z.literal("welcome") }),
    organizationProgressStepSchema.extend({
      key: z.literal("applicability_check"),
    }),
    organizationProgressStepSchema.extend({ key: z.literal("gap_analysis") }),
    organizationProgressStepSchema.extend({
      key: z.literal("documents_uploaded"),
    }),
    organizationProgressStepSchema.extend({ key: z.literal("action_plan") }),
    organizationProgressStepSchema.extend({ key: z.literal("next_steps") }),
  ]),
});

export type OrganizationProgress = z.infer<typeof organizationProgressSchema>;
export type OrganizationProgressStepKey = z.infer<
  typeof organizationProgressStepKeySchema
>;
export type OrganizationProgressStepStatus = z.infer<
  typeof organizationProgressStepStatusSchema
>;
