import * as z from "zod";
import { jobDtoSchema } from "../common/jobs";

export const retryableGapAnalysisCycleStatuses = ["failed", "cancelled"] as const;

export function isRetryableGapAnalysisCycleStatus(status: string) {
  return (retryableGapAnalysisCycleStatuses as readonly string[]).includes(status);
}

export const gapAnalysisCycleGenerationSchema = z.object({
  id: z.uuid(),
  status: z.enum(["locked", "generated", "failed", "cancelled"]),
  outputLocale: z.enum(["de", "en"]),
  lockVersion: z.number().int().positive(),
  generationJobId: z.uuid(),
  aiProcessingRunId: z.uuid().nullable(),
  outputGapRevisionId: z.uuid().nullable(),
});

export const gapGenerationEnqueueResponseSchema = z.object({
  job: jobDtoSchema,
  reused: z.boolean(),
});

export const gapContradictionResolutionSchema = z.object({
  sourceChoice: z.enum(["questionnaire", "document"]),
}).strict();

export type GapGenerationEnqueueResponse = z.infer<typeof gapGenerationEnqueueResponseSchema>;

export const gapEntitySchema = z.object({ id: z.uuid() }).loose();
export const gapQuestionnaireInputSchema = z.object({
  assessmentId: z.uuid(),
  draftId: z.uuid(),
});
export const gapQuestionnaireDraftAnswerSchema = z.object({
  draftId: z.uuid(),
  optionId: z.string().trim().min(1),
});
export const gapAnalysisCycleQuerySchema = z.object({ assessmentId: z.uuid() });
export const gapAnalysisCyclePrepareSchema = z
  .object({
    assessmentId: z.uuid(),
    selectedDocumentIds: z.array(z.uuid()),
  })
  .strict();
export const gapAnalysisCycleEvidenceSchema = z
  .object({
    draftId: z.uuid(),
    selectedDocumentIds: z.array(z.uuid()),
  })
  .strict();
export const gapAnalysisEvidenceReplaceSchema = gapAnalysisCycleEvidenceSchema.omit({ draftId: true });
export const gapAnalysisCycleGenerateSchema = z.object({
  draftId: z.uuid(),
});
export const gapAnalysisCycleRetrySchema = z.object({
  draftId: z.uuid(),
  retryNonce: z.string().trim().min(1).max(100),
});
export const gapAnalysisGenerationJobSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("start"),
  }).strict(),
  z.object({
    operation: z.literal("retry"),
    retryNonce: z.string().trim().min(1).max(100),
  }).strict(),
]);

export const gapWorkflowReadSchema = z.object({
  workflow: z.object({
    canContribute: z.boolean(),
    canManage: z.boolean(),
    release: z.unknown().nullable(),
    assessment: z.unknown().nullable(),
    run: z.unknown().nullable(),
    analysisCycle: z.unknown().nullable(),
    acceptedRevision: z.unknown().nullable(),
    candidateRevision: z.unknown().nullable(),
    acceptedFindings: z.array(z.unknown()),
    candidateFindings: z.array(z.unknown()),
    prerequisite: z.discriminatedUnion("satisfied", [
      z.object({
        satisfied: z.literal(true),
        status: z.literal("eligible"),
        destination: z.string(),
      }),
      z.object({
        satisfied: z.literal(false),
        status: z.enum([
          "missing",
          "definition_incompatible",
          "invalid",
          "not_eligible",
        ]),
        reason: z
          .enum([
            "unsupported_country",
            "clarification_required",
            "not_directly_in_scope",
          ])
          .optional(),
        outcome: z.string().optional(),
        countryCode: z.string().nullable().optional(),
        supportedCountryCodes: z.array(z.string()),
        destination: z.string(),
      }),
    ]),
  }).loose(),
}).superRefine((value, context) => {
  const forbidden = new Set([
    "selectedDocumentVersionIds",
    "documentVersionId",
    "versionNumber",
    "currentVersionId",
  ]);
  const visit = (candidate: unknown, path: PropertyKey[]) => {
    if (!candidate || typeof candidate !== "object") return;
    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => visit(item, [...path, index]));
      return;
    }
    for (const [key, item] of Object.entries(candidate)) {
      if (forbidden.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Browser workflow contains forbidden document version field: ${key}`,
          path: [...path, key] as Array<string | number>,
        });
      }
      visit(item, [...path, key]);
    }
  };
  visit(value.workflow, ["workflow"]);
});

export const gapRevisionReadSchema = z.object({
  revision: gapEntitySchema,
  findings: z.array(z.unknown()),
  staleness: z.unknown().nullable(),
});
export const gapInputsReadSchema = z.object({ inputs: z.unknown() });
export const gapHistoryReadSchema = z.object({ history: z.array(z.unknown()) });
