import { GapQuestionnaireStep } from "@/components/gap-analysis/gap-questionnaire-step";
import { modulesMessages } from "@/lib/i18n/messages/modules";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("gap questionnaire background saving", () => {
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
    expect(html).toContain("lucide-key-round");
    expect(html).toContain("Next category");
    expect(submitButton).toBeDefined();
    expect(submitButton).not.toContain(" disabled=");
  });
});
