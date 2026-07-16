import * as z from "zod";

export const submitApplicabilityCheckSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        value: z.union([
          z.string().trim().min(1),
          z.array(z.string().trim().min(1)).min(1),
        ]),
      }),
    )
    .min(1),
});

export const claimGuestApplicabilityCheckSchema = z.object({
  organizationId: z.uuid(),
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
