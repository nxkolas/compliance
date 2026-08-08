import { ApplicabilityWizard } from "@/components/applicability-check/applicability-wizard";
import { getDictionaryForLocale } from "@/lib/i18n";
import { getCurrentApplicabilityDefinition } from "@/src/server/definitions/applicability";
import type { ApplicabilityQuestionnaireDto } from "@/src/server/applicability-check/service";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function wizardQuestionnaire(
  locale: "de" | "en" = "de",
  latestAnswers: ApplicabilityQuestionnaireDto["latestAnswers"] = {},
): ApplicabilityQuestionnaireDto {
  const definition = getCurrentApplicabilityDefinition(locale);
  return {
    id: definition.questionnaireId,
    locale: definition.locale,
    title: definition.questionnaireTitle,
    code: definition.questionnaireCode,
    versionLabel: definition.releaseVersionLabel,
    questions: definition.questions.map(({ factMappings, ...question }) => {
      void factMappings;
      return question;
    }),
    entityCatalogs: {},
    contentByStableKey: definition.contentByStableKey,
    defaultAnswers: {},
    latestAnswers,
    definition: {
      hash: definition.aggregateHash,
      versionLabel: definition.releaseVersionLabel,
      supportedJurisdictionCodes: ["DE"],
    },
  };
}

describe("applicability wizard", () => {
  it("starts with the Germany-connection step and shows the step indicator", () => {
    const labels =
      getDictionaryForLocale("de").modules.applicabilityCheck.form;
    const html = renderToStaticMarkup(
      <ApplicabilityWizard
        submitUrl="/submit"
        successUrl="/success"
        questionnaire={wizardQuestionnaire()}
        labels={labels}
      />,
    );

    expect(html).toContain("Welche Aussage trifft auf die bewertete Organisation zu?");
    expect(html).toContain(`Schritt 1 von 1`);
    expect(html).toContain(labels.next);
    expect(html).not.toContain(labels.previous);
  });

  it("localizes the wizard labels in English", () => {
    const labels =
      getDictionaryForLocale("en").modules.applicabilityCheck.form;
    const html = renderToStaticMarkup(
      <ApplicabilityWizard
        submitUrl="/submit"
        successUrl="/success"
        questionnaire={wizardQuestionnaire("en")}
        labels={labels}
      />,
    );

    expect(html).toContain(
      "Which statement applies to the organisation being assessed?",
    );
    expect(html).toContain("Step 1 of 1");
  });

  it("renders one filled selection indicator in a selected single-choice card", () => {
    const questionnaire = wizardQuestionnaire();
    const entryQuestion = questionnaire.questions.find(
      (question) => question.stableKey === "bc.germany_connection",
    );
    if (!entryQuestion) throw new Error("Germany-connection question is missing");

    const html = renderToStaticMarkup(
      <ApplicabilityWizard
        submitUrl="/submit"
        successUrl="/success"
        questionnaire={wizardQuestionnaire("de", {
          [entryQuestion.id]: "de_established",
        })}
        labels={getDictionaryForLocale("de").modules.applicabilityCheck.form}
      />,
    );
    const selectedLabel = entryQuestion.options.find(
      (option) => option.stableValue === "de_established",
    )?.label;
    if (!selectedLabel) throw new Error("Selected option is missing");
    const labelIndex = html.indexOf(selectedLabel);
    const buttonStart = html.lastIndexOf("<button", labelIndex);
    const buttonEnd = html.indexOf("</button>", labelIndex);
    const selectedButton = html.slice(buttonStart, buttonEnd);

    expect(
      selectedButton.match(/lucide-circle-check(?:\s|&quot;|")/gu) ?? [],
    ).toHaveLength(1);
  });

  it("enables Continue after the current question is answered", () => {
    const questionnaire = wizardQuestionnaire();
    const entryQuestion = questionnaire.questions.find(
      (question) => question.stableKey === "bc.germany_connection",
    );
    if (!entryQuestion) throw new Error("Germany-connection question is missing");
    const labels = getDictionaryForLocale("de").modules.applicabilityCheck.form;
    const html = renderToStaticMarkup(
      <ApplicabilityWizard
        submitUrl="/submit"
        successUrl="/success"
        questionnaire={wizardQuestionnaire("de", {
          [entryQuestion.id]: "de_established",
        })}
        labels={labels}
      />,
    );
    const labelIndex = html.indexOf(`>${labels.next}</button>`);
    const buttonStart = html.lastIndexOf("<button", labelIndex);
    const buttonEnd = html.indexOf(">", buttonStart);
    const continueButton = html.slice(buttonStart, buttonEnd);

    expect(continueButton).not.toMatch(/\sdisabled(?:=|\s|$)/u);
  });
});
