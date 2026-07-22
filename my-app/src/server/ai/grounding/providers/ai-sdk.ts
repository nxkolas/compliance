import { generateObject } from "ai";
import type * as z from "zod";
import { getChatModelId, getComplianceChatModelById } from "@/lib/ai/models";
import type { AiProviderMode } from "@/lib/ai/types";
import type { GroundedProvider } from "../types";

export function createAiSdkGroundedProvider(mode: AiProviderMode): GroundedProvider {
  const model = getChatModelId(mode);
  return {
    mode,
    provider: mode,
    model,
    async run(input: { system: string; prompt: string; schema: z.ZodType }) {
      const result = await generateObject({
        model: getComplianceChatModelById(mode, model),
        schema: input.schema,
        system: input.system,
        prompt: input.prompt,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(providerTimeoutMs()),
      });
      return {
        output: result.object,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cachedInputTokens: result.usage.cachedInputTokens,
        },
      };
    },
  };
}

function providerTimeoutMs() {
  const configured = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(configured) ? Math.max(5_000, Math.min(300_000, configured)) : 120_000;
}
