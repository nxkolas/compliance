import { generateObject } from "ai";
import { getComplianceChatModelById } from "@/lib/ai/models";
import { gapModelResponseSchema } from "./generation-schema";

export type GapGenerationModel = {
  provider: string;
  model: string;
  generate(input: { system: string; prompt: string }): Promise<{
    value: unknown;
    inputTokens?: number;
    outputTokens?: number;
  }>;
};

export function createGapGenerationModel(model: string): GapGenerationModel {
  return {
    provider: "openai",
    model,
    async generate(input) {
      const result = await generateObject({
        model: getComplianceChatModelById("openai", model),
        schema: gapModelResponseSchema,
        system: input.system,
        prompt: input.prompt,
        maxRetries: 0,
      });
      return {
        value: result.object,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      };
    },
  };
}
