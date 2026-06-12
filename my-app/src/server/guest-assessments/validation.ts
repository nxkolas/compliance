import * as z from "zod";

export const guestAssessmentIdSchema = z.uuid();

export const createGuestAssessmentSchema = z.object({
  companyName: z.string().trim().min(1).max(255),
  captchaToken: z.string().trim().min(1).optional(),
});

export const saveGuestAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      }),
    )
    .min(1)
    .max(25),
});

export type CreateGuestAssessmentInput = z.infer<
  typeof createGuestAssessmentSchema
>;
export type SaveGuestAnswersInput = z.infer<typeof saveGuestAnswersSchema>;
