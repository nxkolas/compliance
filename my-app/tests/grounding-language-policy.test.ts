import { describe, expect, it } from "vitest";
import * as z from "zod";
import type {
  LanguageClassification,
  LanguageDetector,
} from "@/src/server/modules/grounding/language-detector";
import { localAggregateLanguageDetector } from "@/src/server/modules/grounding/language-detector";
import {
  assertOutputLocaleMatches,
  executeLanguageValidatedProvider,
} from "@/src/server/modules/grounding/language-policy";
import type { GroundedProvider } from "@/src/server/modules/grounding/types";

const outputSchema = z.object({
  prose: z.string(),
  evidenceExcerpt: z.string(),
});

function provider(
  outputs: Array<z.infer<typeof outputSchema>>,
): GroundedProvider {
  let index = 0;
  return {
    mode: "self_hosted",
    provider: "fake",
    model: "fake",
    async run() {
      const output = outputs[index++];
      if (!output) throw new Error("Unexpected provider attempt");
      return {
        output,
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          cachedInputTokens: 2,
        },
      };
    },
  };
}

function detector(
  classifications: LanguageClassification[],
  documents: string[] = [],
): LanguageDetector {
  let index = 0;
  return {
    implementation: "fake-detector",
    version: "test",
    async classify(document) {
      documents.push(document);
      const classification = classifications[index++];
      if (!classification) throw new Error("Unexpected detector attempt");
      return classification;
    },
  };
}

function execute(input: {
  outputs: Array<z.infer<typeof outputSchema>>;
  classifications: LanguageClassification[];
  expectedLocale?: "de" | "en";
  documents?: string[];
}) {
  return executeLanguageValidatedProvider({
    provider: provider(input.outputs),
    prompt: { system: "same", prompt: "same" },
    schema: outputSchema,
    expectedLocale: input.expectedLocale ?? "de",
    generatedProse: (output) => [output.prose],
    detector: detector(input.classifications, input.documents),
  });
}

describe("grounded output language policy", () => {
  it("rejects existing-run recovery when the pinned locale differs", () => {
    expect(() => assertOutputLocaleMatches("de", "en")).toThrowError(
      expect.objectContaining({ code: "GROUNDING_LOCALE_CONFLICT" }),
    );
    expect(() => assertOutputLocaleMatches("de", "de")).not.toThrow();
  });

  it.each([
    ["de", "Deutsche Begründung"],
    ["en", "English rationale"],
  ] as const)("accepts matching %s prose on the first attempt", async (locale, prose) => {
    const result = await execute({
      expectedLocale: locale,
      outputs: [{ prose, evidenceExcerpt: "source" }],
      classifications: [{ kind: "match", detected: locale, confidence: 0.98 }],
    });
    expect(result.output.prose).toBe(prose);
    expect(result.attemptCount).toBe(1);
    expect(result.languageValidation.attempts[0]?.disposition).toBe("match");
  });

  it("retries one confident mismatch and aggregates provider usage", async () => {
    const result = await execute({
      outputs: [
        { prose: "Wrong language", evidenceExcerpt: "source" },
        { prose: "Richtige Sprache", evidenceExcerpt: "source" },
      ],
      classifications: [
        { kind: "confident_mismatch", detected: "en", confidence: 0.96 },
        { kind: "match", detected: "de", confidence: 0.94 },
      ],
    });
    expect(result.output.prose).toBe("Richtige Sprache");
    expect(result.attemptCount).toBe(2);
    expect(result.usage).toEqual({
      inputTokens: 20,
      outputTokens: 10,
      cachedInputTokens: 4,
    });
    expect(result.languageValidation.attempts[0]?.retryTriggered).toBe(true);
  });

  it("fails after two confident mismatches without returning rejected text", async () => {
    await expect(
      execute({
        outputs: [
          { prose: "First rejected output", evidenceExcerpt: "source" },
          { prose: "Second rejected output", evidenceExcerpt: "source" },
        ],
        classifications: [
          { kind: "confident_mismatch", detected: "en", confidence: 0.95 },
          { kind: "confident_mismatch", detected: "en", confidence: 0.97 },
        ],
      }),
    ).rejects.toMatchObject({
      code: "AI_OUTPUT_LANGUAGE_MISMATCH",
      attemptCount: 2,
      usage: { inputTokens: 20, outputTokens: 10 },
    });
  });

  it("accepts and records an indeterminate aggregate classification", async () => {
    const result = await execute({
      outputs: [{ prose: "ISO 27001 SOC SIEM", evidenceExcerpt: "source" }],
      classifications: [
        { kind: "indeterminate", detected: null, confidence: null },
      ],
    });
    expect(result.attemptCount).toBe(1);
    expect(result.languageValidation.attempts[0]?.disposition).toBe(
      "indeterminate",
    );
  });

  it("fails closed when detector execution is unavailable", async () => {
    const failingDetector: LanguageDetector = {
      implementation: "broken",
      version: "test",
      async classify() {
        throw new Error("private detector detail");
      },
    };
    await expect(
      executeLanguageValidatedProvider({
        provider: provider([
          { prose: "Text", evidenceExcerpt: "sensitive quotation" },
        ]),
        prompt: { system: "same", prompt: "same" },
        schema: outputSchema,
        expectedLocale: "de",
        generatedProse: (output) => [output.prose],
        detector: failingDetector,
      }),
    ).rejects.toMatchObject({
      code: "AI_LANGUAGE_VALIDATION_UNAVAILABLE",
      attemptCount: 1,
    });
  });

  it("passes only operation-declared generated prose to the detector", async () => {
    const documents: string[] = [];
    await execute({
      outputs: [
        {
          prose: "Die Kontrolle wird regelmäßig geprüft.",
          evidenceExcerpt: "DO NOT TRANSLATE THIS ENGLISH SOURCE QUOTATION",
        },
      ],
      classifications: [{ kind: "match", detected: "de", confidence: 0.9 }],
      documents,
    });
    expect(documents).toEqual(["Die Kontrolle wird regelmäßig geprüft."]);
  });
});

describe("local aggregate language detector", () => {
  it("accepts German compliance prose containing English security terms", async () => {
    await expect(
      localAggregateLanguageDetector.classify(
        "Die Organisation muss das Incident Response Team und das SIEM regelmäßig prüfen. Die Ergebnisse werden durch die verantwortliche Stelle dokumentiert und sind für die nächste Kontrolle verfügbar.",
        "de",
      ),
    ).resolves.toMatchObject({ kind: "match", detected: "de" });
  });

  it("classifies clear English prose and leaves signal-poor text indeterminate", async () => {
    await expect(
      localAggregateLanguageDetector.classify(
        "The organization must review the policy and the evidence that is used for the control.",
        "en",
      ),
    ).resolves.toMatchObject({ kind: "match", detected: "en" });
    await expect(
      localAggregateLanguageDetector.classify("ISO 27001 SOC SIEM", "de"),
    ).resolves.toMatchObject({ kind: "indeterminate" });
  });
});
