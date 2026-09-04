import {
  ApplicabilityWizard,
  SectionedMultiSelect,
  WizardBackButton,
} from "@/components/applicability-check/applicability-wizard";
import { getDictionaryForLocale } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ApplicabilityQuestionnaireDto } from "@/src/server/modules/applicability-check";
import { getCurrentApplicabilityDefinition } from "@/src/server/modules/applicability-check/release/current";
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
  it.each([
    ["question 3", "bc.sector"],
    ["question 4", "bc.activity"],
  ])("renders %s options with the standard full-card button", (_, stableKey) => {
    const questionnaire = wizardQuestionnaire();
    const question = questionnaire.questions.find(
      (candidate) => candidate.stableKey === stableKey,
    );
    const sectorQuestion = questionnaire.questions.find(
      (candidate) => candidate.stableKey === "bc.sector",
    );
    if (!question || !sectorQuestion) {
      throw new Error(`Missing wizard question ${stableKey}`);
    }

    const html = renderToStaticMarkup(
      <TooltipProvider>
        <SectionedMultiSelect
          answer={[]}
          contentByStableKey={questionnaire.contentByStableKey}
          labels={getDictionaryForLocale("de").modules.applicabilityCheck.form}
          onChange={vi.fn()}
          options={question.options}
          sectorQuestion={sectorQuestion}
        />
      </TooltipProvider>,
    );
    const selectableCards =
      html.match(/<button[^>]*aria-pressed="false"[^>]*>/gu) ?? [];

    expect(selectableCards).toHaveLength(question.options.length);
    expect(
      selectableCards.every(
        (card) =>
          card.includes('type="button"') &&
          card.includes("min-h-12") &&
          card.includes("w-full") &&
          card.includes("rounded-xl") &&
          card.includes("text-left") &&
          card.includes("font-semibold"),
      ),
    ).toBe(true);
    expect(html).not.toContain('role="checkbox"');
    if (stableKey === "bc.sector") {
      expect(html).not.toMatch(/<legend[^>]*>other<\/legend>/u);
    }

    const selectionIndicators =
      html.match(/<span[^>]*data-selection-indicator[^>]*>/gu) ?? [];
    expect(selectionIndicators).toHaveLength(question.options.length);
    expect(
      selectionIndicators.every(
        (indicator) =>
          indicator.includes("absolute") &&
          indicator.includes("right-4") &&
          indicator.includes("top-1/2") &&
          indicator.includes("-translate-y-1/2"),
      ),
    ).toBe(true);
  });

  it("renders the clickable back button with an enabled visual state", () => {
    const html = renderToStaticMarkup(
      <WizardBackButton label="ZURÜCK" onClick={vi.fn()} />,
    );

    expect(html).not.toContain("bg-primary/50");
    expect(html).not.toContain("text-primary-foreground/50");
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-primary-foreground");
  });

  it("starts with the Germany-connection step in the styled wizard shell", () => {
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

    expect(html).toContain(
      "Welche Aussage trifft auf die bewertete Organisation zu?",
    );
    expect(html).toContain("Schritt 1 von 1");
    expect(html).toContain(`aria-label="1: ${labels.current}"`);
    expect(html).toContain("ring-primary/20");
    expect(html).not.toContain("bg-success");
    expect(html).toContain(
      `0 ${labels.of} 1 ${labels.questionsAnswered}`,
    );
    expect(html).toContain(labels.next);
    expect(html).not.toContain(labels.previous);

    const nextLabelIndex = html.indexOf(`>${labels.next}</span>`);
    const buttonStart = html.lastIndexOf("<button", nextLabelIndex);
    const buttonEnd = html.indexOf(">", buttonStart);
    expect(html.slice(buttonStart, buttonEnd)).toContain('type="button"');
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
    const labelIndex = html.indexOf(`>${labels.next}</span>`);
    const buttonStart = html.lastIndexOf("<button", labelIndex);
    const buttonEnd = html.indexOf(">", buttonStart);
    const continueButton = html.slice(buttonStart, buttonEnd);

    expect(continueButton).not.toMatch(/\sdisabled(?:=|\s|$)/u);
  });
});
