import * as z from "zod";

export const gapQuestionnaireSubmissionSchema = z.object({
  assessmentId: z.uuid(),
  answers: z
    .array(z.object({ questionId: z.uuid(), optionId: z.uuid() }))
    .min(1),
});

export const gapReassessmentPrepareSchema = z.object({
  assessmentId: z.uuid(),
  selectedDocumentVersionIds: z.array(z.uuid()),
});

export const gapReassessmentEvidenceSchema = z.object({
  draftId: z.uuid(),
  expectedLockVersion: z.number().int().positive(),
  selectedDocumentVersionIds: z.array(z.uuid()),
});

export const gapReassessmentGenerateSchema = z.object({
  draftId: z.uuid(),
  expectedLockVersion: z.number().int().positive(),
});

export const gapReassessmentRetrySchema = z.object({
  draftId: z.uuid(),
  retryNonce: z.string().trim().min(1).max(100),
});

const localizedTextSchema = z.object({
  de: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

export const gapCorrectionRequestSchema = z.object({
  corrections: z.array(z.object({
    findingId: z.uuid(),
    status: z
      .enum([
        "fulfilled",
        "partially_fulfilled",
        "not_fulfilled",
        "insufficient_evidence",
      ])
      .optional(),
    evidenceSufficiency: z.enum(["sufficient", "partial", "none"]).optional(),
    rationale: localizedTextSchema.optional(),
    recommendation: localizedTextSchema.optional(),
    assumptions: z.array(z.string().trim().min(1)).optional(),
    requiresReview: z.boolean().optional(),
    reason: z.string().trim().min(1),
    resolutionReason: z.string().trim().min(1).optional(),
  })).min(1),
});

export const actionPlanGenerationRequestSchema = z.object({
  approvedGapRevisionId: z.uuid(),
});

export const actionPlanReconciliationPrepareSchema = z.object({
  targetGapRevisionId: z.uuid(),
});

export const actionPlanReconciliationDecisionSchema = z.object({
  decision: z.enum([
    "carry_over",
    "close",
    "reopen",
    "create_follow_up",
    "keep_legacy",
    "cancel",
  ]),
  reason: z.string().trim().min(1).max(2_000),
});

export const actionPlanReconciliationActivateSchema = z.object({
  reconciliationId: z.uuid(),
});

export const actionPlanItemUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  ownerUserId: z.uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
}).refine(
  (value) => Object.values(value).some((item) => item !== undefined),
  "At least one action-item field is required",
);
