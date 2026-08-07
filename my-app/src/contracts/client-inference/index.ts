import * as z from "zod";

/**
 * What a client may post back after running an inference request locally.
 *
 * `output` is deliberately `unknown`: it is whatever the local model produced,
 * and it is validated against the operation's own schema by the grounding
 * gateway when the parked job resumes, not here. Validating it twice against
 * two different schemas would let this route decide admissibility, which is
 * exactly what the trust boundary says it must not do.
 */
export const clientInferenceResultSchema = z.object({
  output: z.unknown(),
  /**
   * Which model actually answered, as reported by the client. Recorded as an
   * attestation and compared against what the server asked for; never trusted
   * as proof.
   */
  reportedModelId: z.string().trim().min(1).max(200).optional(),
  attestedUsage: z
    .object({
      inputTokens: z.number().int().min(0).optional(),
      outputTokens: z.number().int().min(0).optional(),
    })
    .optional(),
});

export const clientInferenceFailureSchema = z.object({
  failureCode: z
    .enum([
      "LOCAL_MODEL_UNREACHABLE",
      "LOCAL_MODEL_TIMEOUT",
      "LOCAL_MODEL_REJECTED_SCHEMA",
      "LOCAL_MODEL_ERROR",
      "CLIENT_ABANDONED",
    ])
    .default("LOCAL_MODEL_ERROR"),
  failureMessage: z.string().trim().max(500).default("The local model failed."),
});

export type ClientInferenceResultInput = z.infer<
  typeof clientInferenceResultSchema
>;
export type ClientInferenceFailureInput = z.infer<
  typeof clientInferenceFailureSchema
>;
