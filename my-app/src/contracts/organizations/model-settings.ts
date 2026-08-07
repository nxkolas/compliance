import * as z from "zod";

/**
 * The models an organization has chosen to run itself, with what a connect
 * probe observed them doing.
 *
 * The capability fields are probe results rather than preferences, which is why
 * they are required. `supportsStructuredOutputs` in particular cannot be taken
 * on trust: a model that ignores a JSON schema answers HTTP 200 with invented
 * keys, and the failure only shows up later as a rejected generation.
 */
export const organizationModelSettingsInputSchema = z.object({
  generation: z.object({
    modelId: z.string().trim().min(1).max(200),
    maxContextTokens: z.number().int().min(1024).max(1_000_000),
    supportsStructuredOutputs: z.literal(true, {
      error:
        "A model that does not honour a JSON schema cannot be used for grounded generation",
    }),
    thinkingStyle: z.enum(["none", "ollama", "vllm"]).default("none"),
  }),
  embedding: z.object({
    modelId: z.string().trim().min(1).max(200),
    // Defaults to the model id. A distinct value only matters where one name
    // serves several builds, such as a requantised local model.
    revision: z.string().trim().min(1).max(200).optional(),
    // pgvector's storage ceiling; the column itself is undimensioned.
    dimensions: z.number().int().min(1).max(16000),
    instructionProfile: z
      .enum(["none", "qwen3-query-v1", "e5-query-v1"])
      .default("none"),
  }),
});

export type OrganizationModelSettingsInput = z.infer<
  typeof organizationModelSettingsInputSchema
>;
