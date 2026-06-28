import * as z from "zod";

export const submitApplicabilityCheckSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        value: z.string().trim().min(1),
      }),
    )
    .min(1),
});

export const claimGuestApplicabilityCheckSchema = z.object({
  organizationName: z.string().trim().min(1).max(255),
  checkId: z.uuid().optional(),
});

export const guestApplicabilityCheckReferenceSchema = z.object({
  checkId: z.uuid().optional(),
});

export type SubmitApplicabilityCheckInput = z.infer<
  typeof submitApplicabilityCheckSchema
>;

export type ClaimGuestApplicabilityCheckInput = z.infer<
  typeof claimGuestApplicabilityCheckSchema
>;
