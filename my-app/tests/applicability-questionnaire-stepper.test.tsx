import { ApplicabilityQuestionnaireForm } from "@/components/applicability-check/applicability-questionnaire-form";
import { getDictionaryForLocale } from "@/lib/i18n";
import type { ApplicabilityQuestionnaireDto } from "@/src/server/applicability-check/service";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const questionnaire: ApplicabilityQuestionnaireDto = {
  id: "questionnaire-1",
  locale: "de",
  title: "Betroffenheitscheck",
  code: "nis2",
  versionLabel: "2026-v1",
  questions: [
    {
      id: "hidden-question",
      stableKey: "test.hidden",
      position: 1,
      questionText: "Ausgeblendete Testfrage",
      helpText: null,
      tooltipText: null,
      answerType: "single_choice",
      required: false,
      config: {
        visibleWhen: {
          questionStableKey: "test.unavailable",
          operator: "equals",
          value: "yes",
        },
      },
      options: [],
    },
    {
      id: "question-1",
      stableKey: "test.question",
      position: 2,
      questionText: "Testfrage",
      helpText: null,
      tooltipText: null,
      answerType: "single_choice",
      required: true,
      config: {},
      options: [
        {
          id: "option-yes",
          stableValue: "yes",
          catalogCode: "all",
          label: "Ja",
          position: 1,
          metadata: {},
        },
        {
          id: "option-no",
          stableValue: "no",
          catalogCode: "all",
          label: "Nein",
          position: 2,
          metadata: {},
        },
      ],
    },
  ],
  entityCatalogs: {},
  defaultAnswers: {},
  latestAnswers: {
    "question-1": "yes",
  },
  definition: {
    hash: "hash",
    versionLabel: "2026-v1",
    supportedJurisdictionCodes: ["DE"],
  },
};

describe("applicability questionnaire stepper", () => {
  it("keeps the current answer blue until it is confirmed with continue", () => {
    const labels =
      getDictionaryForLocale("de").modules.applicabilityCheck.form;
    const html = renderToStaticMarkup(
      <ApplicabilityQuestionnaireForm
        submitUrl="/submit"
        successUrl="/success"
        presentation="authenticated-stepper"
        questionnaire={questionnaire}
        labels={labels}
      />,
    );

    expect(html).toContain(`aria-label="1: ${labels.current}"`);
    expect(html).toContain("ring-primary/20");
    expect(html).not.toContain("bg-success");
    expect(html).toContain(`0 ${labels.of} 2 ${labels.questionsAnswered}`);
    const calculateButton = html.match(
      /<button[^>]*data-applicability-calculate="true"[^>]*>/,
    )?.[0];
    expect(calculateButton).toContain('type="button"');

    const answerButton = html.match(
      /<button[^>]*data-slot="toggle-group-item"[^>]*>/,
    )?.[0];
    expect(answerButton).toContain('type="button"');
  });

  it("explains the effect of changing the country next to the country field", () => {
    const labels =
      getDictionaryForLocale("de").modules.applicabilityCheck.form;
    const countryQuestionnaire: ApplicabilityQuestionnaireDto = {
      ...questionnaire,
      questions: [{
        id: "country-question",
        stableKey: "bc.jurisdiction_country",
        position: 2,
        questionText: "Welcher EU-Mitgliedstaat ist hauptsächlich zuständig?",
        helpText: null,
        tooltipText: null,
        answerType: "single_choice",
        required: true,
        config: { ui: { control: "select" } },
        options: [
          {
            id: "country-de",
            stableValue: "DE",
            catalogCode: "all",
            label: "Deutschland",
            position: 1,
            metadata: {},
          },
          {
            id: "country-at",
            stableValue: "AT",
            catalogCode: "all",
            label: "Österreich",
            position: 2,
            metadata: {},
          },
        ],
      }],
      latestAnswers: { "country-question": "AT" },
    };
    const html = renderToStaticMarkup(
      <ApplicabilityQuestionnaireForm
        submitUrl="/submit"
        successUrl="/success"
        presentation="authenticated-stepper"
        questionnaire={countryQuestionnaire}
        labels={labels}
      />,
    );

    expect(html).toContain("data-country-change-info");
    expect(html).toContain(labels.countryChangeHint);
    expect(html).toContain("border-[#EAB446]");

    const germanHtml = renderToStaticMarkup(
      <ApplicabilityQuestionnaireForm
        submitUrl="/submit"
        successUrl="/success"
        presentation="authenticated-stepper"
        questionnaire={{
          ...countryQuestionnaire,
          latestAnswers: { "country-question": "DE" },
        }}
        labels={labels}
      />,
    );
    expect(germanHtml).not.toContain("data-country-change-info");
  });
});
