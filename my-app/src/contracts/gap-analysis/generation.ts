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

export type GapGenerationEnqueueResponse = z.infer<typeof gapGenerationEnqueueResponseSchema>;

export const gapEntitySchema = z.object({ id: z.uuid() }).loose();
export const gapQuestionnaireInputSchema = z.object({
  assessmentId: z.uuid(),
  draftId: z.uuid(),
  expectedVersion: z.number().int().positive(),
});
export const gapQuestionnaireDraftAnswerSchema = z.object({
  draftId: z.uuid(),
  optionId: z.uuid(),
  expectedVersion: z.number().int().positive(),
});
export const gapCorrectionInputSchema = z.object({
  corrections: z.array(z.object({
    findingId: z.uuid(),
    status: z.enum(["fulfilled", "partially_fulfilled", "not_fulfilled", "insufficient_evidence"]).optional(),
    evidenceSufficiency: z.enum(["sufficient", "partial", "none"]).optional(),
    requiresReview: z.boolean().optional(),
    reason: z.string().trim().min(1),
    resolutionReason: z.string().trim().min(1).optional(),
  }).strict()).length(1),
});
export const gapGuidanceRegenerationInputSchema = z.object({
  findingId: z.uuid(),
  reason: z.string().trim().min(1),
  retryNonce: z.string().trim().min(1).max(100).optional(),
}).strict();
export const gapRevisionMutationPayloadSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("correction"),
    sourceRevisionId: z.uuid(),
    findingId: z.uuid(),
    correctedStatus: z.enum(["fulfilled", "partially_fulfilled", "not_fulfilled", "insufficient_evidence"]).optional(),
    correctedEvidenceSufficiency: z.enum(["sufficient", "partial", "none"]).optional(),
    requiresReview: z.boolean().optional(),
    reason: z.string().trim().min(1),
    resolutionReason: z.string().trim().min(1).optional(),
    retryNonce: z.string().trim().min(1).max(255),
  }).strict(),
  z.object({
    mode: z.literal("guidance_regeneration"),
    sourceRevisionId: z.uuid(),
    findingId: z.uuid(),
    reason: z.string().trim().min(1),
    retryNonce: z.string().trim().min(1).max(255),
  }).strict(),
]);
export type GapRevisionMutationPayload = z.infer<typeof gapRevisionMutationPayloadSchema>;
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
    expectedLockVersion: z.number().int().positive(),
    selectedDocumentIds: z.array(z.uuid()),
  })
  .strict();
export const gapAnalysisEvidenceReplaceSchema = gapAnalysisCycleEvidenceSchema.omit({ draftId: true });
export const gapAnalysisCycleGenerateSchema = z.object({
  draftId: z.uuid(),
  expectedLockVersion: z.number().int().positive(),
});
export const gapAnalysisCycleRetrySchema = z.object({
  draftId: z.uuid(),
  retryNonce: z.string().trim().min(1).max(100),
});
export const gapAnalysisGenerationJobSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("start"),
    expectedLockVersion: z.number().int().positive(),
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
          "release_incompatible",
          "not_approved",
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
