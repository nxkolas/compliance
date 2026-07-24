export type OutputLocale = "de" | "en";

export type LanguageClassification =
  | { kind: "match"; detected: OutputLocale; confidence: number }
  | {
      kind: "confident_mismatch";
      detected: OutputLocale;
      confidence: number;
    }
  | {
      kind: "indeterminate";
      detected: string | null;
      confidence: number | null;
    };

export type LanguageDetector = {
  implementation: string;
  version: string;
  classify(
    document: string,
    expectedLocale: OutputLocale,
  ): Promise<LanguageClassification>;
};

/**
 * Confidence is deliberately conservative. Compliance prose often contains
 * English product names, acronyms, and security terminology inside otherwise
 * German sentences. A classification is confident only when there are at
 * least four language-specific signals, the leading language owns at least
 * 72% of them, and the normalized score margin is at least 0.35.
 */
export const LOCAL_LANGUAGE_CONFIDENCE_POLICY = {
  minimumSignals: 4,
  minimumConfidence: 0.72,
  minimumMargin: 0.35,
} as const;

const germanSignals = new Set([
  "aber",
  "alle",
  "als",
  "auch",
  "auf",
  "aus",
  "bei",
  "das",
  "dass",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "durch",
  "eine",
  "einem",
  "einen",
  "einer",
  "eines",
  "für",
  "ist",
  "mit",
  "muss",
  "nicht",
  "oder",
  "sind",
  "und",
  "von",
  "werden",
  "wird",
  "zu",
  "zur",
  "zum",
]);

const englishSignals = new Set([
  "a",
  "all",
  "also",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "must",
  "not",
  "of",
  "on",
  "or",
  "should",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "will",
  "with",
]);

export const localAggregateLanguageDetector: LanguageDetector = {
  implementation: "complyx-local-stopword-detector",
  version: "1",
  async classify(document, expectedLocale) {
    const tokens = document.toLocaleLowerCase("und").match(/\p{L}+/gu) ?? [];
    let german = 0;
    let english = 0;
    for (const token of tokens) {
      if (germanSignals.has(token)) german += 1;
      if (englishSignals.has(token)) english += 1;
      if (/[äöüß]/u.test(token)) german += 2;
    }

    const total = german + english;
    if (total < LOCAL_LANGUAGE_CONFIDENCE_POLICY.minimumSignals) {
      return {
        kind: "indeterminate",
        detected: null,
        confidence: total ? Math.max(german, english) / total : null,
      };
    }
    const detected: OutputLocale = german >= english ? "de" : "en";
    const confidence = Math.max(german, english) / total;
    const margin = Math.abs(german - english) / total;
    if (
      confidence < LOCAL_LANGUAGE_CONFIDENCE_POLICY.minimumConfidence ||
      margin < LOCAL_LANGUAGE_CONFIDENCE_POLICY.minimumMargin
    ) {
      return { kind: "indeterminate", detected, confidence };
    }
    return detected === expectedLocale
      ? { kind: "match", detected, confidence }
      : { kind: "confident_mismatch", detected, confidence };
  },
};
