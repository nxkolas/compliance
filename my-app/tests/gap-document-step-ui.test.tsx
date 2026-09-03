import { GapAnalysisStepper } from "@/components/gap-analysis/gap-analysis-stepper";
import { GapDocumentStep } from "@/components/gap-analysis/gap-document-step";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { modulesMessages } from "@/lib/i18n/messages/modules";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const organizationId = "00000000-0000-4000-8000-000000000001";

function workflowFixture() {
  return {
    canContribute: true,
    documentLibrary: {
      documents: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          title: "NIS2-Richtlinie Umsetzungskonzept",
          mimeType: "application/pdf",
          archivedAt: null,
          eligibleForAnalysis: true,
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          title: "Archivierte Datenschutzfolgeabschätzung",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          archivedAt: "2026-07-12T12:00:00.000Z",
          eligibleForAnalysis: false,
        },
      ],
    },
  } as unknown as Parameters<typeof GapDocumentStep>[0]["workflow"];
}

function collectElements(node: ReactNode) {
  const elements: ReactElement<Record<string, unknown>>[] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    elements.push(child);
    elements.push(...collectElements(child.props.children as ReactNode));
  });

  return elements;
}

describe("Gap document step", () => {
  it("renders workflow documents and preserves the saved selection state", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapDocumentStep
        organizationId={organizationId}
        workflow={workflowFixture()}
        labels={labels}
        selected={["00000000-0000-4000-8000-000000000002"]}
        busy={false}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(html).toContain("NIS2-Richtlinie Umsetzungskonzept");
    expect(html).toContain("Archivierte Datenschutzfolgeabschätzung");
    expect(html).toContain('data-document-selected="true"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain(labels.documentActive);
    expect(html).toContain(labels.documentArchived);
    expect(html).toContain(labels.documentTitleColumn);
    expect(html).toContain(labels.documentTypeColumn);
    expect(html).toContain(labels.documentSizeColumn);
    expect(html).toContain(labels.documentDateColumn);
    expect(html).toContain(labels.documentStatusColumn);
    expect(html).toContain("min-w-[1190px]");
    expect(html).toContain("outline-[1.2px]");
    expect(html).toContain("h-20");
  });

  it("opens the upload flow from step 2 and keeps the continue action presentation", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapDocumentStep
        organizationId={organizationId}
        workflow={workflowFixture()}
        labels={labels}
        selected={[]}
        busy={false}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(html).toContain("data-gap-document-upload-trigger");
    expect(html).not.toContain(
      `href="/tool/organizations/${organizationId}/documents"`,
    );
    expect(html).toContain(labels.openLibrary);
    expect(html).toContain("background-color:#002BFF");
    expect(html).toContain(labels.continueWithoutDocuments);
    expect(html).toContain("/images/Maskottchen_ohneLogo.svg");
    expect(html).toContain("data-gap-document-speech-bubble");
    expect(html).toContain("#111825");
    expect(html).toContain("#1A2540");
    expect(html).toContain("#3D4049");
  });

  it("centers the empty document message inside its box", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapDocumentStep
        organizationId={organizationId}
        workflow={{
          ...workflowFixture(),
          documentLibrary: { documents: [] },
        }}
        labels={labels}
        selected={[]}
        busy={false}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(html).toContain("data-gap-empty-documents");
    expect(html).toContain("min-h-24 items-center justify-center");
    expect(html).toContain("px-6 py-6 text-center");
    expect(html).toContain(labels.noDocumentsAvailable);
  });

  it("forwards checkbox changes and the existing continue callback", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const onToggle = vi.fn();
    const onContinue = vi.fn();
    const tree = GapDocumentStep({
      organizationId,
      workflow: workflowFixture(),
      labels,
      selected: [],
      busy: false,
      onToggle,
      onContinue,
    });
    const elements = collectElements(tree);
    const checkboxes = elements.filter((element) => element.type === Checkbox);
    const continueButton = elements.find(
      (element) =>
        element.type === Button && element.props.variant === "outline",
    );

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[1]?.props.disabled).toBe(true);
    (
      checkboxes[0]?.props.onCheckedChange as
        | ((checked: boolean) => void)
        | undefined
    )?.(true);
    (continueButton?.props.onClick as (() => void) | undefined)?.();

    expect(onToggle).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000002",
      true,
    );
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("shows the data-driven completed, active, and unavailable step states", () => {
    const labels = modulesMessages.de.modules.gapAnalysis.workflow;
    const html = renderToStaticMarkup(
      <GapAnalysisStepper
        activeStep="documents"
        availableSteps={["questions", "documents", "review", "gaps"]}
        labels={labels}
        onNavigate={vi.fn()}
        variant="questionnaire"
      />,
    );

    expect(html).toContain("bg-[#46A95A]");
    expect(html).toContain('aria-current="step"');
    expect(html.match(/bg-\[#46A95A\]/g)).toHaveLength(1);
    expect(html.match(/bg-\[#002BFF\] text-white/g)).toHaveLength(1);
    expect(html.match(/bg-\[#002BFF\]\/20/g)).toHaveLength(2);
    expect(html).not.toContain("ring-[#4F8EF7]/20");
    expect(html).toContain(labels.steps.questions);
    expect(html).toContain(labels.steps.documents);
    expect(html).toContain(labels.steps.review);
    expect(html).toContain(labels.steps.gaps);
  });
});
