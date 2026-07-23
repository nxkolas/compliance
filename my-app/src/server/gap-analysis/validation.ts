import { gapCorrectionInputSchema, gapQuestionnaireInputSchema } from "@/src/contracts/gap-analysis/generation";
export {
  actionPlanGenerationRequestSchema,
  actionPlanItemUpdateSchema,
} from "@/src/contracts/action-plans";
export {
  gapReassessmentEvidenceSchema,
  gapReassessmentGenerateSchema,
  gapReassessmentPrepareSchema,
  gapReassessmentRetrySchema,
} from "@/src/contracts/gap-analysis/generation";

export const gapQuestionnaireSubmissionSchema = gapQuestionnaireInputSchema;

export const gapCorrectionRequestSchema = gapCorrectionInputSchema;
