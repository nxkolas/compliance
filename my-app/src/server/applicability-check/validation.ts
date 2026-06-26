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

export type SubmitApplicabilityCheckInput = z.infer<
  typeof submitApplicabilityCheckSchema
>;
