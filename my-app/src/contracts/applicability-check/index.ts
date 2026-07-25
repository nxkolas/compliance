import * as z from "zod";

export const applicabilitySubmissionSchema = z.object({
  guestSession: z.object({ id: z.uuid(), token: z.string().min(32) }).optional(),
  answers: z.array(z.object({
    questionId: z.uuid(),
    value: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
  })).min(1),
});
export const applicabilityResultSchema = z.object({
  artifactRevisionId: z.uuid(),
  artifactRevisionNumber: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  ruleSetId: z.uuid().nullable(),
  ruleSetVersionLabel: z.string().nullable(),
  assessmentRevisionId: z.uuid().nullable(),
  evidence: z.object({ outcome: z.string() }).loose(),
  result: z.object({ outcome: z.string() }).loose(),
  release: z.object({
    id: z.uuid(),
    versionLabel: z.string(),
    isOutdated: z.boolean(),
    activeVersionLabel: z.string(),
    supportedCountryCodes: z.array(z.string().length(2)),
  }),
});
export const applicabilityQuestionnaireSchema = z.object({
  id: z.uuid(),
  questions: z.array(z.unknown()),
  defaultAnswers: z.record(z.string(), z.unknown()),
  latestAnswers: z.record(z.string(), z.unknown()),
  release: z
    .object({ supportedCountryCodes: z.array(z.string().length(2)) })
    .loose(),
}).loose();
export const applicabilityOverviewSchema = z.object({ assessmentId: z.uuid() }).loose();
export const applicabilityAnswersSchema = z.object({ assessmentId: z.uuid(), answers: z.array(z.unknown()) }).loose();
export const claimGuestApplicabilityCheckSchema = z.object({
  organizationId: z.uuid(),
  checkId: z.uuid().optional(),
});
export const guestApplicabilityCheckReferenceSchema = z.object({
  checkId: z.uuid().optional(),
});
