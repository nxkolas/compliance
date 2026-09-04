import { describe, expect, it } from "vitest";
import { resolveGapContentTranslation } from "@/src/server/modules/gap-analysis/localize-content";

describe("gap release metadata localization", () => {
  const translations = new Map([
    [
      "questionnaire-title",
      new Map([
        ["de", "Fragebogen"],
        ["en", "Questionnaire"],
      ]),
    ],
  ]);

  it("resolves the requested German and English title", () => {
    expect(
      resolveGapContentTranslation(
        translations,
        "questionnaire-title",
        "de",
        "en",
      ),
    ).toBe("Fragebogen");
    expect(
      resolveGapContentTranslation(
        translations,
        "questionnaire-title",
        "en",
        "de",
      ),
    ).toBe("Questionnaire");
  });

  it("uses only the release default locale as fallback", () => {
    const germanOnly = new Map([
      ["questionnaire-title", new Map([["de", "Fragebogen"]])],
    ]);

    expect(
      resolveGapContentTranslation(
        germanOnly,
        "questionnaire-title",
        "en",
        "de",
      ),
    ).toBe("Fragebogen");
    expect(() =>
      resolveGapContentTranslation(
        germanOnly,
        "questionnaire-title",
        "en",
        "fr",
      ),
    ).toThrow(/has no runtime translation/);
  });
});
