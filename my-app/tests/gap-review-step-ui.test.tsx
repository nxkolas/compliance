import { GapAnalysisStepper } from "@/components/gap-analysis/gap-analysis-stepper";
import { GapReviewStep } from "@/components/gap-analysis/gap-review-step";
import { modulesMessages } from "@/lib/i18n/messages/modules";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

describe("gap review step presentation", () => {
  it("groups real localized answers by the ordered release categories", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapReviewStep
        workflow={
          {
            release: {
              versionLabel: "release-visible",
              requirements: [
                {
                  id: "internal-category-2",
                  stableKey: "category-2",
                  title: "Zweite Kategorie",
                  position: 2,
                  questionStableKeys: ["question-3"],
                },
                {
                  id: "internal-category-1",
                  stableKey: "category-1",
                  title: "Erste Kategorie",
                  position: 1,
                  questionStableKeys: ["question-1", "question-2"],
                },
              ],
              questions: [
                {
                  id: "internal-question-1",
                  stableKey: "question-1",
                  questionText:
                    "Eine besonders lange echte Frage, die innerhalb ihrer Karte sinnvoll umbrechen muss?",
                  options: [
                    {
                      id: "internal-option-implemented",
                      label: "Vollständig umgesetzt",
                    },
                  ],
                },
                {
                  id: "internal-question-2",
                  stableKey: "question-2",
                  questionText: "Zweite echte Frage?",
                  options: [
                    {
                      id: "internal-option-partial",
                      label: "Teilweise umgesetzt",
                    },
                  ],
                },
                {
                  id: "internal-question-3",
                  stableKey: "question-3",
                  questionText: "Dritte echte Frage?",
                  options: [
                    {
                      id: "internal-option-unknown",
                      label: "Unsicher",
                    },
                  ],
                },
              ],
            },
            documentLibrary: { documents: [] },
            analysisCycle: null,
            run: null,
            candidateRevision: null,
          } as never
        }
        labels={labels}
        answers={{
          "internal-question-1": "internal-option-implemented",
          "internal-question-2": "internal-option-partial",
          "internal-question-3": "internal-option-unknown",
        }}
        selected={[]}
        busy={null}
        generating={false}
        locale="de"
        onNavigate={vi.fn()}
        onGenerate={vi.fn()}
        onRetry={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(html).toContain("Ihre Angaben im Überblick");
    expect(html).toContain("Kategorie 1 von 2");
    expect(html).toContain("Kategorie 2 von 2");
    expect(html.indexOf("Erste Kategorie")).toBeLessThan(
      html.indexOf("Zweite Kategorie"),
    );
    expect(html.match(/data-gap-review-question/g)).toHaveLength(3);
    expect(html).toContain("Vollständig umgesetzt");
    expect(html).toContain("Teilweise umgesetzt");
    expect(html).toContain("Unsicher");
    expect(html).toContain("break-words");
    expect(html).not.toContain("internal-option-implemented");
    expect(html).not.toContain("internal-question-1");
    expect(html).not.toContain("fully_implemented");
  });

  it("shows steps one and two complete, review active, and gaps inactive", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapAnalysisStepper
        activeStep="review"
        availableSteps={["questions", "documents", "review"]}
        labels={labels}
        onNavigate={vi.fn()}
        variant="questionnaire"
      />,
    );

    expect(html.match(/bg-\[\#46A95A\]/g)).toHaveLength(2);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("border-[#002BFF] bg-[#002BFF] text-white");
    expect(
      html.match(/linear-gradient\(rgba\(0, 43, 255, 0\.13\)/g),
    ).toHaveLength(4);
    expect(html).toContain("text-slate-400");
  });
});
