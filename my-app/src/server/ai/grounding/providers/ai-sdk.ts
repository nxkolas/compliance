import { generateObject } from "ai";
import type * as z from "zod";
import { getChatModelId, getComplianceChatModelById } from "@/lib/ai/models";
import type { AiProviderMode } from "@/lib/ai/types";
import { getGenerationOptions } from "@/lib/ai/generation-options";
import type { GroundedProvider } from "../types";
import {
  combineAbortSignals,
  GenerationFailure,
} from "../../generation";

export function createAiSdkGroundedProvider(
  mode: AiProviderMode,
): GroundedProvider {
  const model = getChatModelId(mode);
  return {
    mode,
    provider: mode,
    model,
    async run(input: {
      system: string;
      prompt: string;
      schema: z.ZodType;
      abortSignal?: AbortSignal;
    }) {
      const timeoutSignal = AbortSignal.timeout(providerTimeoutMs());
      try {
        const result = await generateObject({
          model: getComplianceChatModelById(mode, model),
          schema: input.schema,
          system: input.system,
          prompt: input.prompt,
          maxRetries: 0,
          maxOutputTokens: groundedMaxOutputTokens(),
          abortSignal: combineAbortSignals([
            input.abortSignal,
            timeoutSignal,
          ]),
          ...getGenerationOptions(mode, { thinking: false }),
        });
        return {
          output: result.object,
          usage: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            cachedInputTokens: result.usage.cachedInputTokens,
          },
        };
      } catch (error) {
        if (input.abortSignal?.aborted) {
          const cancelled = new Error("AI provider request was cancelled", {
            cause: error,
          });
          cancelled.name = "AbortError";
          throw cancelled;
        }
        if (timeoutSignal.aborted) {
          const transient = new Error("AI provider request timed out", {
            cause: error,
          });
          transient.name = "ProviderTimeoutError";
          Object.assign(transient, { code: "ETIMEDOUT", statusCode: 503 });
          throw transient;
        }
        const issues = validationIssues(error);
        if (
          issues.length > 0 &&
          process.env.NODE_ENV !== "production" &&
          process.env.WORKER_DEBUG_ERRORS === "1"
        ) {
          console.error(
            "AI schema validation diagnostic",
            JSON.stringify({ issues }),
          );
        }
        if (issues.length > 0) {
          throw new GenerationFailure(
            "repairable_content",
            "GENERATION_SCHEMA_INVALID",
            { cause: error },
          );
        }
        throw error;
      }
    },
  };
}

function validationIssues(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!isRecord(current)) return [];
    if (Array.isArray(current.issues)) {
      return current.issues.slice(0, 50).map((issue) => {
        if (!isRecord(issue)) return { message: String(issue) };
        return {
          path: Array.isArray(issue.path) ? issue.path : [],
          code: typeof issue.code === "string" ? issue.code : "unknown",
          message:
            typeof issue.message === "string"
              ? issue.message
              : "Validation failed",
        };
      });
    }
    current = current.cause;
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function groundedMaxOutputTokens() {
  const raw = process.env.AI_GROUNDED_MAX_OUTPUT_TOKENS?.trim() || "9000";
  const configured = Number(raw);
  return Number.isFinite(configured)
    ? Math.max(512, Math.min(12_000, configured))
    : 9_000;
}

function providerTimeoutMs() {
  const configured = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(configured)
    ? Math.max(5_000, Math.min(300_000, configured))
    : 120_000;
}
