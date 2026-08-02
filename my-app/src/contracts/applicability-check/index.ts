import * as z from "zod";

export const applicabilitySubmissionSchema = z.object({
  guestSession: z
    .object({ id: z.uuid(), token: z.string().min(32) })
    .optional(),
  locale: z.enum(["de", "en"]).default("de"),
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        value: z.union([
          z.string().trim().min(1),
          z.array(z.string().trim().min(1)).min(1),
        ]),
      }),
    )
    .min(1),
});

export const applicabilityResultSchema = z.object({
  outputRevisionId: z.uuid(),
  outputRevisionNumber: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  assessmentRevisionId: z.uuid().nullable(),
  evidence: z.object({ outcome: z.string() }).loose(),
  result: z.object({ outcome: z.string() }).loose(),
  definition: z.object({
    hash: z.string().min(1),
    versionLabel: z.string(),
    isOutdated: z.boolean(),
    supportedJurisdictionCodes: z.array(z.string().length(2)),
  }),
});

export const applicabilityQuestionnaireSchema = z
  .object({
    id: z.string().min(1),
    questions: z.array(z.unknown()),
    defaultAnswers: z.record(z.string(), z.unknown()),
    latestAnswers: z.record(z.string(), z.unknown()),
    definition: z.object({
      hash: z.string().min(1),
      versionLabel: z.string(),
      supportedJurisdictionCodes: z.array(z.string().length(2)),
    }),
  })
  .loose();

export const applicabilityOverviewSchema = z
  .object({ assessmentId: z.uuid() })
  .loose();
export const applicabilityAnswersSchema = z
  .object({ assessmentId: z.uuid(), answers: z.array(z.unknown()) })
  .loose();
export const claimGuestApplicabilityCheckSchema = z.object({
  organizationId: z.uuid(),
  checkId: z.uuid().optional(),
});
export const guestApplicabilityCheckReferenceSchema = z.object({
  checkId: z.uuid().optional(),
});
