import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActionPlanWorkflow } from "@/components/action-plans/action-plan-workflow";
import { getDefaultDictionary } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("action plan empty state", () => {
  it("renders the Figma empty state without changing the existing destination", () => {
    const labels = getDefaultDictionary().modules.actionPlan.workflow;
    const html = renderToStaticMarkup(
      <ActionPlanWorkflow
        organizationId="organization-1"
        current={null}
        canContribute
        labels={labels}
      />,
    );

    expect(html).toContain("data-action-plan-empty-state");
    expect(html).toContain("data-action-plan-speech-bubble");
    expect(html).toContain("/robot-sad.svg");
    expect(html).toContain("Ihr Maßnahmenplan ist noch nicht verfügbar");
    expect(html).toContain("Betroffenheitscheck durchführen");
    expect(html).toContain("Warum diese Reihenfolge?");
    expect(html).toContain("Gut zu wissen");
    expect(html).toContain(
      'href="/tool/organizations/organization-1/gap-analysis"',
    );
    expect(html).toContain("xl:w-[694px]");
    expect(html).toContain("xl:size-[560px]");
  });
});
