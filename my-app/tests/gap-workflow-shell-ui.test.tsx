import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GapAnalysisWorkflow } from "@/components/gap-analysis/gap-analysis-workflow";
import type { GapWorkflow } from "@/components/gap-analysis/types";
import { modulesMessages } from "@/src/i18n/messages/modules";
import type {
  GapPostGenerationView,
  GapWorkflowStep,
} from "@/src/server/modules/gap-analysis/workflow-state";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const labels = modulesMessages.de.modules.gapAnalysis.workflow;

function createWorkflow(
  mode: "collecting_inputs" | "generating" | "generated_editable",
) {
  const generated = mode === "generated_editable";
  const generating = mode === "generating";

  return {
    release: {
      id: "release-1",
      versionLabel: "v1",
      requirements: [
        {
          id: "requirement-1",
          stableKey: "requirement-1",
          title: "Organisation",
          position: 1,
          questionStableKeys: ["question-1"],
        },
      ],
      questions: [
        {
          id: "question-1",
          stableKey: "question-1",
          questionText: "Ist die Verantwortlichkeit festgelegt?",
          required: true,
          options: [{ id: "yes", label: "Ja" }],
        },
      ],
    },
    prerequisite: {
      satisfied: true,
      status: "eligible",
      destination: "/tool/organizations/organization-1/applicability-check",
    },
    assessment: { id: "assessment-1", currentRevisionId: "assessment-revision-1" },
    answers: { "question-1": "yes" },
    questionnaireDraft: {
      id: "questionnaire-draft-1",
      version: 1,
      status: "submitted",
    },
    analysisCycle: {
      selected: [],
      draft: {
        id: "cycle-1",
        status: generating ? "locked" : "open",
        generationJobId: generating ? "job-1" : null,
        outputLocale: "de",
      },
      summary: {
        assessmentRevisionNumber: 1,
        requirementCount: 1,
      },
    },
    revision: generated ? { id: "gap-revision-1", outputLocale: "de" } : null,
    documentLibrary: { documents: [] },
    run: null,
    candidateRevision: null,
    generatedInputs: null,
    history: [],
    findings: [],
    lifecycleMode: mode,
    lifecycle: {
      showGeneratedViews: generated,
      inputsEditable: mode === "collecting_inputs",
      canFinalize: generated,
      locked: false,
    },
    canContribute: true,
    canManage: false,
  } as unknown as GapWorkflow;
}

function renderWorkflow(
  workflow: GapWorkflow,
  initialStep: GapWorkflowStep,
  initialView: GapPostGenerationView = "results",
) {
  return renderToStaticMarkup(
    <GapAnalysisWorkflow
      organizationId="organization-1"
      workflow={workflow}
      labels={labels}
      locale="de"
      initialStep={initialStep}
      initialView={initialView}
    />,
  );
}

function expectCommonShell(html: string, contentMarker: string) {
  expect(html).toContain("data-gap-workflow-shell");
  expect(html.match(/data-gap-stepper-variant=/g)).toHaveLength(1);
  expect(html.indexOf("data-gap-stepper-variant=")).toBeLessThan(
    html.indexOf(contentMarker),
  );
}

describe("gap analysis workflow shell continuity", () => {
  it.each([
    ["questions", "data-gap-questionnaire"],
    ["documents", "data-gap-document-speech-bubble"],
    ["review", "data-gap-review"],
  ] as const)("keeps the common shell around the %s step", (step, marker) => {
    const html = renderWorkflow(createWorkflow("collecting_inputs"), step);

    expectCommonShell(html, marker);
    expect(html).toContain(marker);
  });

  it("keeps review cards and the stepper visible while generation is running", () => {
    const html = renderWorkflow(createWorkflow("generating"), "review");

    expectCommonShell(html, "data-gap-review");
    expect(html).toContain("data-gap-review");
    expect(html).toContain(labels.generating);
    expect(html).toContain('aria-current="step"');
  });

  it("renders finished results inside the same shell with step four active", () => {
    const html = renderWorkflow(createWorkflow("generated_editable"), "gaps");

    expectCommonShell(html, 'role="tabpanel"');
    expect(html).toContain('role="tabpanel"');
    expect(html).not.toContain(labels.resultsView);
    expect(html).not.toContain(labels.inputsUsed);
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain(labels.resultTitle);
    expect(html.match(/bg-\[\#46A95A\]/g)).toHaveLength(4);
    expect(html).toContain('aria-current="step"');
  });
});
