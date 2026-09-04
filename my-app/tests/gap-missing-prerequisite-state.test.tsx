import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GapAnalysisWorkflow } from "@/components/gap-analysis/gap-analysis-workflow";
import type { GapWorkflow } from "@/components/gap-analysis/types";
import { getDefaultDictionary } from "@/src/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function workflow(
  prerequisite: GapWorkflow["prerequisite"],
  assessment: GapWorkflow["assessment"] = null,
) {
  return {
    release: { questions: [], requirements: [] },
    prerequisite,
    assessment,
    answers: {},
    questionnaireDraft: null,
    analysisCycle: null,
    revision: null,
    generatedInputs: null,
    history: [],
    lifecycleMode: "collecting_inputs",
    lifecycle: {
      showGeneratedViews: false,
      inputsEditable: true,
    },
    canContribute: true,
  } as unknown as GapWorkflow;
}

function render(workflowValue: GapWorkflow) {
  return renderToStaticMarkup(
    <GapAnalysisWorkflow
      organizationId="organization-1"
      workflow={workflowValue}
      labels={getDefaultDictionary().modules.gapAnalysis.workflow}
      locale="de"
      initialStep="questions"
      initialView="results"
    />,
  );
}

describe("gap analysis missing prerequisite state", () => {
  it("renders the Figma state when the applicability result is missing", () => {
    const html = render(workflow({
      satisfied: false,
      status: "missing",
      supportedCountryCodes: ["DE"],
      destination: "/tool/organizations/organization-1/applicability-check",
    }));

    expect(html).toContain("data-gap-missing-prerequisite");
    expect(html).toContain("data-gap-prerequisite-speech-bubble");
    expect(html).toContain("data-applicability-check-icon");
    expect(html).toContain("Ihre Gap-Analyse kann noch nicht gestartet werden");
    expect(html).toContain("Betroffenheitscheck durchführen");
    expect(html).toContain("Warum diese Reihenfolge?");
    expect(html).toContain("Gut zu wissen");
    expect(html).toContain("/robot-sad.svg");
    expect(html).toContain("lg:mt-16");
    expect(html).toContain("xl:left-[690px]");
    expect(html).toContain("xl:size-[560px]");
    expect(html).toContain("min-h-[384px]");
    expect(html).toContain(
      'href="/tool/organizations/organization-1/applicability-check"',
    );
  });

  it("renders the unsupported-country explanation inside the robot speech bubble", () => {
    const labels = getDefaultDictionary().modules.gapAnalysis.workflow;
    const html = render(workflow({
      satisfied: false,
      status: "not_eligible",
      reason: "unsupported_country",
      outcome: "clarification_required",
      countryCode: "AT",
      supportedCountryCodes: ["DE"],
      destination: "/tool/organizations/organization-1/applicability-check",
    }));

    expect(html).toContain("data-gap-missing-prerequisite");
    expect(html).toContain("data-gap-prerequisite-speech-bubble");
    expect(html).toContain("/robot-sad.svg");
    expect(html).toContain("OOPS!");
    expect(html).toContain(labels.prerequisiteUnsupportedTitle);
    expect(html).toContain(
      labels.prerequisiteUnsupported.replace("{countries}", "Deutschland"),
    );
    expect(html).toContain(labels.reviewApplicability);
    expect(html).not.toContain("Warum diese Reihenfolge?");
    expect(html).not.toContain("Gut zu wissen");
  });

  it("keeps incompatible applicability results on the existing blocked card", () => {
    const html = render(workflow({
      satisfied: false,
      status: "definition_incompatible",
      supportedCountryCodes: ["DE"],
      destination: "/tool/organizations/organization-1/applicability-check",
    }));

    expect(html).not.toContain("data-gap-missing-prerequisite");
    expect(html).not.toContain("/robot-sad.svg");
    expect(html).toContain("Aktuelles bestätigtes Ergebnis erforderlich");
  });

  it("keeps the existing next state after applicability is completed", () => {
    const html = render(workflow({
      satisfied: true,
      status: "eligible",
      destination: "/tool/organizations/organization-1/applicability-check",
    }));

    expect(html).not.toContain("data-gap-missing-prerequisite");
    expect(html).not.toContain("/robot-sad.svg");
    expect(html).toContain("Bereit für Ihre Gap-Analyse");
  });
});
