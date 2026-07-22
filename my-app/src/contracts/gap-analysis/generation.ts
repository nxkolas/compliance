import * as z from "zod";
import { jobDtoSchema } from "../common/jobs";

export const retryableGapReassessmentStatuses = ["failed", "cancelled"] as const;

export function isRetryableGapReassessmentStatus(status: string) {
  return (retryableGapReassessmentStatuses as readonly string[]).includes(status);
}

export const gapGenerationDraftSchema = z.object({
  id: z.uuid(),
  status: z.enum(["locked", "generated", "failed", "cancelled"]),
  lockVersion: z.number().int().positive(),
  generationJobId: z.uuid(),
  aiProcessingRunId: z.uuid().nullable(),
  outputGapRevisionId: z.uuid().nullable(),
});

export const gapGenerationEnqueueResponseSchema = z.object({
  draft: gapGenerationDraftSchema,
  job: jobDtoSchema,
  reused: z.boolean(),
});

export type GapGenerationEnqueueResponse = z.infer<typeof gapGenerationEnqueueResponseSchema>;

export const gapEntitySchema = z.object({ id: z.uuid() }).loose();
export const gapQuestionnaireInputSchema = z.object({
  assessmentId: z.uuid(),
  answers: z.array(z.object({ questionId: z.uuid(), optionId: z.uuid() })).min(1),
});
const localizedTextSchema = z.object({ de: z.string().trim().min(1), en: z.string().trim().min(1) });
export const gapCorrectionInputSchema = z.object({
  corrections: z.array(z.object({
    findingId: z.uuid(),
    status: z.enum(["fulfilled", "partially_fulfilled", "not_fulfilled", "insufficient_evidence"]).optional(),
    evidenceSufficiency: z.enum(["sufficient", "partial", "none"]).optional(),
    rationale: localizedTextSchema.optional(),
    recommendation: localizedTextSchema.optional(),
    assumptions: z.array(z.string().trim().min(1)).optional(),
    requiresReview: z.boolean().optional(),
    reason: z.string().trim().min(1),
    resolutionReason: z.string().trim().min(1).optional(),
  })).min(1),
});
export const gapReassessmentQuerySchema = z.object({ assessmentId: z.uuid() });
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

export const gapWorkflowReadSchema = z.object({
  workflow: z.object({
    canContribute: z.boolean(),
    canManage: z.boolean(),
    release: z.unknown().nullable(),
    assessment: z.unknown().nullable(),
    run: z.unknown().nullable(),
    reassessment: z.unknown().nullable(),
    acceptedRevision: z.unknown().nullable(),
    candidateRevision: z.unknown().nullable(),
    acceptedFindings: z.array(z.unknown()),
    candidateFindings: z.array(z.unknown()),
  }).loose(),
});

export const gapRevisionReadSchema = z.object({
  revision: gapEntitySchema,
  findings: z.array(z.unknown()),
  staleness: z.unknown().nullable(),
});
