import * as z from "zod";
import {
  gapEntitySchema,
  gapGenerationEnqueueResponseSchema,
  gapQuestionnaireInputSchema,
  gapQuestionnaireDraftAnswerSchema,
  gapQuestionnaireProgressSchema,
  gapRevisionReadSchema,
  gapWorkflowReadSchema,
  gapInputsReadSchema,
  gapHistoryReadSchema,
} from "@/src/contracts/gap-analysis/generation";
import { jobDtoSchema } from "@/src/contracts/common/jobs";
import { request } from "./api-client";

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

  replaceGapAnalysisEvidence(organizationId: string, input: { cycleId: string; selectedDocumentIds: string[] }) {
    return request(`${analysisCycleBase(organizationId)}/${encodeURIComponent(input.cycleId)}/evidence`, {
      method: "PUT", input: { selectedDocumentIds: input.selectedDocumentIds }, outputSchema: z.object({ analysisCycle: z.unknown() }),
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

  getQuestionnaireProgress(organizationId: string, signal?: AbortSignal) {
    return request(`${gapBase(organizationId)}/progress`, {
      outputSchema: z.object({ progress: gapQuestionnaireProgressSchema }),
      signal,
    });
  },

  resolveContradiction(
    organizationId: string,
    revisionId: string,
    findingId: string,
    sourceChoice: "questionnaire" | "document",
    signal?: AbortSignal,
  ) {
    return request(
      `${gapBase(organizationId)}/revisions/${encodeURIComponent(revisionId)}/contradictions/${encodeURIComponent(findingId)}/resolve`,
      {
        method: "POST",
        input: { sourceChoice },
        idempotencyKey: crypto.randomUUID(),
        outputSchema: z.object({ job: jobDtoSchema, reused: z.boolean() }),
        signal,
      },
    );
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
        outputSchema: z.object({
          answer: z.object({
            draftId: z.uuid(),
            version: z.number().int().positive(),
            questionId: z.string(),
            optionId: z.string(),
          }),
        }).loose(),
        signal,
      },
    );
  },

  enqueueGapAnalysisGeneration(organizationId: string, cycleId: string, input: { operation: "start" } | { operation: "retry"; retryNonce: string }, idempotencyKey: string, signal?: AbortSignal) {
    return request(`${analysisCycleBase(organizationId)}/${encodeURIComponent(cycleId)}/generation-jobs`, {
      method: "POST",
      input,
      idempotencyKey,
      outputSchema: gapGenerationEnqueueResponseSchema,
      signal,
    });
  },
};
