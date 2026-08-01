import * as z from "zod";
import {
  gapCorrectionInputSchema,
  gapGuidanceRegenerationInputSchema,
  gapEntitySchema,
  gapGenerationEnqueueResponseSchema,
  gapQuestionnaireInputSchema,
  gapQuestionnaireDraftAnswerSchema,
  gapRevisionReadSchema,
  gapWorkflowReadSchema,
  gapInputsReadSchema,
  gapHistoryReadSchema,
} from "@/src/contracts/gap-analysis/generation";
import { request } from "./api-client";
import { jobDtoSchema } from "@/src/contracts/common/jobs";

function gapBase(organizationId: string) {
  return `/api/organizations/${encodeURIComponent(organizationId)}/gap-analysis`;
}

function analysisCycleBase(organizationId: string) {
  return `${gapBase(organizationId)}/cycles`;
}

export const gapAnalysisClient = {
  prepareGapAnalysisCycle(organizationId: string, input: { assessmentId: string; selectedDocumentIds: string[] }) {
    return request(analysisCycleBase(organizationId), {
      method: "POST", input, idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ analysisCycle: z.unknown() }),
    });
  },

  replaceGapAnalysisEvidence(organizationId: string, input: { cycleId: string; expectedLockVersion: number; selectedDocumentIds: string[] }) {
    return request(`${analysisCycleBase(organizationId)}/${encodeURIComponent(input.cycleId)}/evidence`, {
      method: "PUT", input: { expectedLockVersion: input.expectedLockVersion, selectedDocumentIds: input.selectedDocumentIds }, ifMatch: input.expectedLockVersion, outputSchema: z.object({ analysisCycle: z.object({ id: z.uuid() }).loose() }),
    });
  },

  getWorkflow(organizationId: string, signal?: AbortSignal) {
    return request(gapBase(organizationId), {
      outputSchema: gapWorkflowReadSchema, signal,
    });
  },

  getRevision(organizationId: string, revisionId: string, signal?: AbortSignal) {
    return request(`${gapBase(organizationId)}/revisions/${encodeURIComponent(revisionId)}`, {
      outputSchema: gapRevisionReadSchema, signal,
    });
  },

  getInputs(organizationId: string, revisionId: string, signal?: AbortSignal) {
    return request(`${gapBase(organizationId)}/revisions/${encodeURIComponent(revisionId)}/inputs`, {
      outputSchema: gapInputsReadSchema,
      signal,
    });
  },

  getHistory(organizationId: string, signal?: AbortSignal) {
    return request(`${gapBase(organizationId)}/history`, {
      outputSchema: gapHistoryReadSchema,
      signal,
    });
  },

  createAssessment(organizationId: string, signal?: AbortSignal) {
    return request(`${gapBase(organizationId)}/assessments`, {
      method: "POST", outputSchema: z.object({ assessment: gapEntitySchema }), signal,
      idempotencyKey: crypto.randomUUID(),
    });
  },

  submitQuestionnaire(organizationId: string, input: z.infer<typeof gapQuestionnaireInputSchema>, signal?: AbortSignal) {
    return request(`${gapBase(organizationId)}/questionnaire-submissions`, {
      method: "POST", input: gapQuestionnaireInputSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ revision: gapEntitySchema }), signal,
    });
  },

  saveQuestionnaireAnswer(
    organizationId: string,
    questionId: string,
    input: z.infer<typeof gapQuestionnaireDraftAnswerSchema>,
    signal?: AbortSignal,
  ) {
    return request(
      `${gapBase(organizationId)}/questionnaire-draft/answers/${encodeURIComponent(questionId)}`,
      {
        method: "PATCH",
        input: gapQuestionnaireDraftAnswerSchema.parse(input),
        ifMatch: input.expectedVersion,
        outputSchema: z.object({
          answer: z.object({
            draftId: z.uuid(),
            version: z.number().int().positive(),
            questionId: z.uuid(),
            optionId: z.uuid(),
            updatedAt: z.string(),
          }),
          completion: z.object({
            answeredRequired: z.number().int().nonnegative(),
            totalRequired: z.number().int().nonnegative(),
            complete: z.boolean(),
          }),
        }),
        signal,
      },
    );
  },

  correctRevision(organizationId: string, revisionId: string, input: z.infer<typeof gapCorrectionInputSchema>, signal?: AbortSignal) {
    return request(`${gapBase(organizationId)}/revisions/${encodeURIComponent(revisionId)}/corrections`, {
      method: "POST", input: gapCorrectionInputSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ job: jobDtoSchema, reused: z.boolean() }), signal,
    });
  },

  regenerateGuidance(
    organizationId: string,
    revisionId: string,
    input: z.infer<typeof gapGuidanceRegenerationInputSchema>,
    signal?: AbortSignal,
  ) {
    return request(
      `${gapBase(organizationId)}/revisions/${encodeURIComponent(revisionId)}/guidance-regenerations`,
      {
        method: "POST",
        input: gapGuidanceRegenerationInputSchema.parse(input),
        idempotencyKey: crypto.randomUUID(),
        outputSchema: z.object({ job: jobDtoSchema, reused: z.boolean() }),
        signal,
      },
    );
  },

  enqueueGapAnalysisGeneration(organizationId: string, cycleId: string, input: { operation: "start"; expectedLockVersion: number } | { operation: "retry"; retryNonce: string }, idempotencyKey: string, signal?: AbortSignal) {
    return request(`${analysisCycleBase(organizationId)}/${encodeURIComponent(cycleId)}/generation-jobs`, {
      method: "POST",
      input,
      idempotencyKey,
      outputSchema: gapGenerationEnqueueResponseSchema,
      signal,
    });
  },
};
