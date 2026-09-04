import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n-config";
import { getNis2ReleaseMessage } from "@/lib/i18n/messages/nis2-release";
import { getCurrentApplicabilityDefinition } from "@/src/server/modules/applicability-check/release/current";
import { nis2Questions } from "@/src/server/modules/compliance/nis2/releases/2026-v1/release-source";

describe("applicability questionnaire i18n ownership", () => {
  it("localizes every semantic question and option through the i18n module", () => {
    for (const locale of locales) {
      const definition = getCurrentApplicabilityDefinition(locale);

      expect(
        definition.questions.map((question) => question.stableKey),
      ).toEqual(nis2Questions.map((question) => question.stableKey));

      for (const sourceQuestion of nis2Questions) {
        const question = definition.questions.find(
          (candidate) => candidate.stableKey === sourceQuestion.stableKey,
        );

        expect(question).toMatchObject({
          questionText: getNis2ReleaseMessage(
            locale,
            `nis2.question.${sourceQuestion.stableKey}.text`,
          ),
          helpText: getNis2ReleaseMessage(
            locale,
            `nis2.question.${sourceQuestion.stableKey}.help`,
          ),
          tooltipText: getNis2ReleaseMessage(
            locale,
            `nis2.question.${sourceQuestion.stableKey}.tooltip`,
          ),
        });
        for (const option of question!.options) {
          expect(option.label).toBe(
            getNis2ReleaseMessage(
              locale,
              `nis2.question.${sourceQuestion.stableKey}.option.${option.stableValue}`,
            ),
          );
          for (const metadataKey of [
            "helperContentKey",
            "definitionContentKey",
          ]) {
            const contentKey = (option.metadata as Record<string, unknown>)[
              metadataKey
            ];
            if (typeof contentKey === "string") {
              expect(definition.contentByStableKey[contentKey]).toBe(
                getNis2ReleaseMessage(locale, contentKey),
              );
            }
          }
        }
      }
    }
  });

  it("keeps presentation fields out of the semantic release source", () => {
    for (const question of nis2Questions) {
      expect(question).not.toHaveProperty("questionText");
      expect(question).not.toHaveProperty("questionTextEn");
      expect(question).not.toHaveProperty("helpText");
      expect(question).not.toHaveProperty("helpTextEn");
      expect(question).not.toHaveProperty("tooltipText");
      expect(question).not.toHaveProperty("tooltipTextEn");
      for (const option of question.options) {
        expect(option).not.toHaveProperty("label");
        expect(option).not.toHaveProperty("labelEn");
      }
    }
  });
});
