import * as z from "zod";
import {
  gapCorrectionInputSchema,
  gapEntitySchema,
  gapGenerationEnqueueResponseSchema,
  gapQuestionnaireInputSchema,
  gapRevisionReadSchema,
  gapWorkflowReadSchema,
} from "@/src/contracts/gap-analysis/generation";
import { request } from "./api-client";

const generationInputSchema = z.object({ draftId: z.uuid(), expectedLockVersion: z.number().int().positive() });
const retryInputSchema = z.object({ draftId: z.uuid(), retryNonce: z.string().min(1).max(100) });

function gapBase(organizationId: string) {
  return `/api/organizations/${encodeURIComponent(organizationId)}/gap-analysis`;
}

function reassessmentBase(organizationId: string) {
  return `${gapBase(organizationId)}/reassessment`;
}

export const gapAnalysisClient = {
  prepareReassessment(organizationId: string, input: { assessmentId: string; selectedDocumentVersionIds: string[] }) {
    return request(reassessmentBase(organizationId), {
      method: "POST", input, idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ reassessment: z.unknown() }),
    });
  },

  updateReassessmentEvidence(organizationId: string, input: { draftId: string; expectedLockVersion: number; selectedDocumentVersionIds: string[] }) {
    return request(`${reassessmentBase(organizationId)}/evidence`, {
      method: "PATCH", input, ifMatch: input.expectedLockVersion, outputSchema: z.object({ draft: z.object({ id: z.uuid() }).loose() }),
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

  correctRevision(organizationId: string, revisionId: string, input: z.infer<typeof gapCorrectionInputSchema>, signal?: AbortSignal) {
    return request(`${gapBase(organizationId)}/revisions/${encodeURIComponent(revisionId)}/correct`, {
      method: "POST", input: gapCorrectionInputSchema.parse(input), idempotencyKey: crypto.randomUUID(), outputSchema: z.object({ revision: gapEntitySchema }), signal,
    });
  },

  generate(organizationId: string, input: z.infer<typeof generationInputSchema>, idempotencyKey: string, signal?: AbortSignal) {
    return request(`${reassessmentBase(organizationId)}/generate`, {
      method: "POST",
      input: generationInputSchema.parse(input),
      idempotencyKey,
      outputSchema: gapGenerationEnqueueResponseSchema,
      signal,
    });
  },

  retry(organizationId: string, input: z.infer<typeof retryInputSchema>, idempotencyKey: string, signal?: AbortSignal) {
    return request(`${reassessmentBase(organizationId)}/retry`, {
      method: "POST",
      input: retryInputSchema.parse(input),
      idempotencyKey,
      outputSchema: gapGenerationEnqueueResponseSchema,
      signal,
    });
  },
};
