import type * as z from "zod";
import { ApiError } from "../../platform/http/errors";
import type {
  LanguageClassification,
  LanguageDetector,
  OutputLocale,
} from "./language-detector";
import type { GroundedProvider } from "./types";

type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
};

export type LanguageValidationAttempt = {
  attempt: number;
  detectedLocale: OutputLocale | "unknown";
  confidence: number | null;
  disposition: LanguageClassification["kind"];
  retryTriggered: boolean;
};

export type LanguageValidationDiagnostic = {
  version: 1;
  detector: {
    implementation: string;
    version: string;
  };
  expectedLocale: OutputLocale;
  attempts: LanguageValidationAttempt[];
  validationError?: "AI_LANGUAGE_VALIDATION_UNAVAILABLE";
};

export class LanguagePolicyError extends ApiError {
  constructor(
    code:
      | "AI_OUTPUT_LANGUAGE_MISMATCH"
      | "AI_LANGUAGE_VALIDATION_UNAVAILABLE",
    public readonly attemptCount: number,
    public readonly languageValidation: LanguageValidationDiagnostic,
    public readonly usage: Usage,
  ) {
    super(
      code === "AI_OUTPUT_LANGUAGE_MISMATCH" ? 422 : 503,
      code === "AI_OUTPUT_LANGUAGE_MISMATCH"
        ? "The generated result used the wrong language"
        : "The generated result language could not be validated",
      undefined,
      code,
    );
    this.name = "LanguagePolicyError";
  }
}

export function assertOutputLocaleMatches(
  storedLocale: unknown,
  requestedLocale: OutputLocale,
  details?: unknown,
) {
  if (storedLocale !== requestedLocale) {
    throw new ApiError(
      409,
      "AI output locale conflicts with the existing work",
      details,
      "GROUNDING_LOCALE_CONFLICT",
    );
  }
}

export async function executeLanguageValidatedProvider<T>(input: {
  provider: GroundedProvider;
  prompt: { system: string; prompt: string };
  schema: z.ZodType<T>;
  expectedLocale: OutputLocale;
  generatedProse(output: T): string[];
  detector: LanguageDetector;
  abortSignal?: AbortSignal;
  onProviderAttempt?(progress: {
    attemptCount: number;
    usage: Usage;
  }): Promise<void>;
}) {
  const diagnostic: LanguageValidationDiagnostic = {
    version: 1,
    detector: {
      implementation: input.detector.implementation,
      version: input.detector.version,
    },
    expectedLocale: input.expectedLocale,
    attempts: [],
  };
  let usage: Usage = {};

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await input.provider.run({
      ...input.prompt,
      schema: input.schema,
      abortSignal: input.abortSignal,
    });
    usage = aggregateUsage(usage, result.usage);
    await input.onProviderAttempt?.({ attemptCount: attempt, usage });
    const parsed = input.schema.parse(result.output);
    const document = input
      .generatedProse(parsed)
      .map((value) => value.trim())
      .filter(Boolean)
      .join("\n\n");

    let classification: LanguageClassification;
    try {
      classification = await input.detector.classify(
        document,
        input.expectedLocale,
      );
    } catch {
      diagnostic.validationError = "AI_LANGUAGE_VALIDATION_UNAVAILABLE";
      diagnostic.attempts.push({
        attempt,
        detectedLocale: "unknown",
        confidence: null,
        disposition: "indeterminate",
        retryTriggered: false,
      });
      throw new LanguagePolicyError(
        "AI_LANGUAGE_VALIDATION_UNAVAILABLE",
        attempt,
        diagnostic,
        usage,
      );
    }

    const retryTriggered =
      classification.kind === "confident_mismatch" && attempt === 1;
    diagnostic.attempts.push({
      attempt,
      detectedLocale:
        classification.kind === "indeterminate"
          ? classification.detected === "de" ||
            classification.detected === "en"
            ? classification.detected
            : "unknown"
          : classification.detected,
      confidence: classification.confidence,
      disposition: classification.kind,
      retryTriggered,
    });

    if (classification.kind !== "confident_mismatch") {
      return {
        output: parsed,
        attemptCount: attempt,
        languageValidation: diagnostic,
        usage,
      };
    }
    if (!retryTriggered) {
      throw new LanguagePolicyError(
        "AI_OUTPUT_LANGUAGE_MISMATCH",
        attempt,
        diagnostic,
        usage,
      );
    }
  }

  throw new Error("Language validation attempt bound was exceeded");
}

function aggregateUsage(left: Usage, right: Usage): Usage {
  return {
    inputTokens: sumOptional(left.inputTokens, right.inputTokens),
    outputTokens: sumOptional(left.outputTokens, right.outputTokens),
    cachedInputTokens: sumOptional(
      left.cachedInputTokens,
      right.cachedInputTokens,
    ),
  };
}

function sumOptional(left?: number, right?: number) {
  return left === undefined && right === undefined
    ? undefined
    : (left ?? 0) + (right ?? 0);
}
