import { GapQuestionnaireStep } from "@/components/gap-analysis/gap-questionnaire-step";
import { GapAnalysisStepper } from "@/components/gap-analysis/gap-analysis-stepper";
import { modulesMessages } from "@/lib/i18n/messages/modules";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("gap questionnaire background saving", () => {
  it("keeps a completed question step green when navigating back to it", () => {
    const labels = modulesMessages.en.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapAnalysisStepper
        activeStep="questions"
        availableSteps={["questions", "documents"]}
        labels={labels}
        onNavigate={vi.fn()}
        variant="questionnaire"
      />,
    );

    const activeStep = html.match(
      /<button[^>]*aria-current="step"[^>]*>[\s\S]*?<\/button>/,
    )?.[0];
    expect(activeStep).toContain("bg-[#46A95A]");
    expect(activeStep).toContain("text-white");
  });

  it("keeps the next-category action available without showing a save spinner", () => {
    const labels = modulesMessages.en.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapQuestionnaireStep
        workflow={
          {
            canContribute: true,
            release: {
              requirements: [
                {
                  id: "requirement-1",
                  stableKey: "requirement-1",
                  title: "First category",
                  icon: "KeyRound",
                  position: 1,
                  questionStableKeys: ["question-1"],
                },
                {
                  id: "requirement-2",
                  stableKey: "requirement-2",
                  title: "Second category",
                  icon: "ShieldAlert",
                  position: 2,
                  questionStableKeys: [],
                },
              ],
              questions: [
                {
                  id: "question-1",
                  stableKey: "question-1",
                  questionText: "Is the control implemented?",
                  helpText: "Choose the current implementation status.",
                  required: true,
                  options: [
                    {
                      id: "option-yes",
                      label: "Yes",
                    },
                  ],
                },
              ],
            },
          } as never
        }
        labels={labels}
        answers={{ "question-1": "option-yes" }}
        busy={false}
        saveState="saving"
        onAnswer={vi.fn().mockResolvedValue(undefined)}
        onContinue={vi.fn()}
      />,
    );

    const submitButton = html.match(
      /<button[^>]*type="submit"[^>]*>/,
    )?.[0];
    expect(html).not.toContain(labels.saving);
    expect(html).toContain("data-gap-questionnaire");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain("Next category");
    expect(submitButton).toBeDefined();
    expect(submitButton).not.toContain(" disabled=");
  });

  it("derives question markers and percentage from the real required questions", () => {
    const labels = modulesMessages.en.modules.gapAnalysis.workflow;
    const questions = [1, 2, 3].map((number) => ({
      id: `question-${number}`,
      stableKey: `question-${number}`,
      questionText: `Question ${number}`,
      helpText: `Help ${number}`,
      required: true,
      options: [{ id: `option-${number}`, label: "Implemented" }],
    }));
    const html = renderToStaticMarkup(
      <GapQuestionnaireStep
        workflow={
          {
            canContribute: true,
            release: {
              requirements: [
                {
                  id: "requirement-1",
                  stableKey: "requirement-1",
                  title: "Real category",
                  icon: "KeyRound",
                  position: 1,
                  questionStableKeys: questions.map((question) => question.stableKey),
                },
              ],
              questions,
            },
          } as never
        }
        labels={labels}
        answers={{ "question-1": "option-1", "question-2": "option-2" }}
        busy={false}
        saveState="idle"
        onAnswer={vi.fn().mockResolvedValue(undefined)}
        onContinue={vi.fn()}
      />,
    );

    expect(html).toContain('aria-valuenow="67"');
    expect(html).toContain("67 %");
    expect(html).toContain("2 of 3 questions answered");
    expect(html).toContain("Real category");
    expect(html).toContain("Help 3");
    expect(html).not.toContain("31 questions answered");
  });
});
