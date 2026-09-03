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
  evidence: z.json(),
  result: z.object({
    outcome: z.enum(["essential_entity", "important_entity", "not_directly_in_scope", "clarification_required"]),
    label: z.string(),
    labelEn: z.string(),
    reasons: z.array(z.string()),
    reasonsEn: z.array(z.string()),
    sizeClassification: z.enum(["small", "medium", "large", "unknown"]),
    jurisdiction: z.object({
      countryCode: z.string().nullable(),
      countryProfileVersion: z.string().nullable(),
    }),
    matchedEntityTypes: z.array(z.object({
      code: z.string(),
      label: z.string(),
      labelEn: z.string(),
      legalReference: z.string(),
    })),
    scopeBases: z.array(z.object({
      code: z.string(),
      description: z.string(),
      descriptionEn: z.string(),
      legalReference: z.string().nullable(),
    })),
    unresolvedFacts: z.array(z.string()),
    unresolvedFactsEn: z.array(z.string()),
    obligationOverlays: z.array(z.object({
      code: z.string(),
      description: z.string(),
      descriptionEn: z.string(),
      legalReference: z.string().nullable(),
    })),
    indirectExposure: z.object({
      status: z.enum(["none", "signals_present", "unknown"]),
      reasons: z.array(z.string()),
      reasonsEn: z.array(z.string()),
    }),
    disclaimer: z.string(),
    disclaimerEn: z.string(),
  }).partial().required({ outcome: true }),
  definition: z.object({
    hash: z.string().min(1),
    versionLabel: z.string(),
    isOutdated: z.boolean(),
    supportedJurisdictionCodes: z.array(z.string().length(2)),
  }),
});

const applicabilityAnswerValueSchema = z.union([
  z.string(),
  z.array(z.string()),
]);
const applicabilityOptionSchema = z.object({
  id: z.string(),
  stableValue: z.string(),
  catalogCode: z.string(),
  label: z.string(),
  position: z.number().int().nonnegative(),
  metadata: z.json(),
});

export const applicabilityQuestionnaireSchema = z.object({
  id: z.string().min(1),
  locale: z.enum(["de", "en"]),
  title: z.string(),
  code: z.string(),
  versionLabel: z.string(),
  questions: z.array(z.object({
    id: z.string(),
    stableKey: z.string(),
    position: z.number().int().nonnegative(),
    questionText: z.string(),
    helpText: z.string().nullable(),
    tooltipText: z.string().nullable(),
    answerType: z.string(),
    required: z.boolean(),
    config: z.json(),
    options: z.array(applicabilityOptionSchema),
  })),
  entityCatalogs: z.record(z.string(), z.array(applicabilityOptionSchema)),
  contentByStableKey: z.record(z.string(), z.string()),
  defaultAnswers: z.record(z.string(), applicabilityAnswerValueSchema),
  latestAnswers: z.record(z.string(), applicabilityAnswerValueSchema),
  definition: z.object({
    hash: z.string().min(1),
    versionLabel: z.string(),
    supportedJurisdictionCodes: z.array(z.string().length(2)),
  }),
  guestSession: z.object({ id: z.uuid(), token: z.string() }).optional(),
});

export const applicabilityOverviewSchema = z.object({
  assessmentId: z.uuid(),
  assessmentRevisionId: z.uuid(),
  assessmentRevisionNumber: z.number().int().positive(),
  submittedAt: z.iso.datetime(),
  result: applicabilityResultSchema.nullable(),
});
export const applicabilityAnswersSchema = z.object({
  assessmentId: z.uuid(),
  assessmentRevisionId: z.uuid(),
  assessmentRevisionNumber: z.number().int().positive(),
  submittedAt: z.iso.datetime(),
  answers: z.array(z.object({
    questionId: z.string(),
    questionStableKey: z.string(),
    questionText: z.string(),
    questionConfig: z.json(),
    questionPosition: z.number().int().nonnegative(),
    answerValue: z.json(),
    answerLabel: z.string().nullable(),
    answerMetadata: z.json(),
  })),
});
export const claimGuestApplicabilityCheckSchema = z.object({
  organizationId: z.uuid(),
  checkId: z.uuid().optional(),
});
export const guestApplicabilityCheckReferenceSchema = z.object({
  checkId: z.uuid().optional(),
});
