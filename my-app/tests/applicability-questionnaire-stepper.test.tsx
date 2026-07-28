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
  moduleId: "module-1",
  questionnaireVersionId: "version-1",
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
  release: {
    id: "release-1",
    versionLabel: "2026-v1",
    aggregateHash: "hash",
    isActive: true,
    activeVersionLabel: "2026-v1",
    supportedCountryCodes: ["DE"],
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
    expect(html).not.toContain("bg-emerald-500");
  });
});
