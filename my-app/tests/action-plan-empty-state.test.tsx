import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActionPlanWorkflow } from "@/components/action-plans/action-plan-workflow";
import { getDefaultDictionary } from "@/src/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("action plan empty state", () => {
  it("renders the Figma available state after a completed gap analysis", () => {
    const labels = getDefaultDictionary().modules.actionPlan.workflow;
    const html = renderToStaticMarkup(
      <ActionPlanWorkflow
        organizationId="organization-1"
        current={null}
        availableGapRevisionId="gap-revision-1"
        canContribute
        labels={labels}
      />,
    );

    expect(html).toContain("data-action-plan-available-state");
    expect(html).toContain("w-full min-w-0");
    expect(html).not.toContain("max-w-[1274px]");
    expect(html).toContain(
      "xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)]",
    );
    expect(html).toContain("data-action-plan-available-speech-bubble");
    expect(html).toContain("h-12 w-fit max-w-full");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("xl:pt-[42px] xl:pb-6");
    expect(html).toContain('data-action-plan-mascot="brand"');
    expect(html).toContain("data-action-plan-mascot-slot");
    expect(html).toContain("xl:h-[320px]");
    expect(html).toContain("xl:items-start");
    expect(html).toContain("xl:pt-24");
    expect(html).toContain("/images/landing/landingpage-maskottchen-mit-logo.svg");
    expect(html).not.toContain("/robot-sad.svg");
    expect(html).toContain("Ihr Maßnahmenplan ist verfügbar");
    expect(html).toContain("Erstellen Sie Ihren Maßnahmenplan");
    expect(html).toContain("Maßnahmenplan erstellen");
    expect(html).not.toContain("data-action-plan-empty-state");
    expect(html).not.toContain("Warum diese Reihenfolge?");
    expect(html).not.toContain("Gut zu wissen");
  });

  it("sends users with a missing applicability check to that check", () => {
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
    expect(html).toContain("w-full min-w-0");
    expect(html).not.toContain("max-w-[1274px]");
    expect(html).toContain("data-action-plan-speech-bubble");
    expect(html).toContain("/robot-sad.svg");
    expect(html).toContain('data-action-plan-mascot="oops"');
    expect(html).toContain("Ihr Maßnahmenplan ist noch nicht verfügbar");
    expect(html).toContain("Betroffenheitscheck durchführen");
    expect(html).toContain("h-12 w-full max-w-full");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("sm:w-auto");
    expect(html).toContain("Warum diese Reihenfolge?");
    expect(html).toContain("Gut zu wissen");
    expect(html).toContain(
      'href="/tool/organizations/organization-1/applicability-check"',
    );
    expect(html).toContain(
      "xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)]",
    );
    expect(html).toContain("xl:h-[384px]");
    expect(html).toContain("xl:items-start");
    expect(html).toContain("xl:pt-24");
    expect(html).toContain("xl:max-w-[516px]");
    expect(html).toContain('viewBox="38 179 932 629"');
  });

  it.each(["review", "no_gaps", "permission", "gap_pending", "gap_generating", "outdated", "unavailable"] as const)("explains %s without asking for another applicability check", (state) => {
    const labels = getDefaultDictionary().modules.actionPlan.workflow;
    const html = renderToStaticMarkup(<ActionPlanWorkflow organizationId="organization-1" current={null} preparationState={state} canContribute={false} labels={labels} />);
    expect(html).toContain(labels.preparation[state].title);
    expect(html).toContain(labels.preparation[state].action);
    expect(html).toContain('href="/tool/organizations/organization-1/gap-analysis"');
    expect(html).toContain("data-action-plan-empty-state");
    expect(html).toContain("Warum diese Reihenfolge?");
    expect(html).toContain("Gut zu wissen");
    expect(html).not.toContain("Betroffenheitscheck durchführen");
    expect(html).not.toContain("Starten Sie zuerst");
  });

  it("shows a disabled creation button while a persisted job is running", () => {
    const labels = getDefaultDictionary().modules.actionPlan.workflow;
    const html = renderToStaticMarkup(<ActionPlanWorkflow organizationId="organization-1" current={null} preparationState="generating" generationJobId="job-1" canContribute labels={labels} />);
    expect(html).toContain(labels.preparation.generating.title);
    expect(html).toContain('role="status"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("/robot-sad.svg");
    expect(html).not.toContain('data-action-plan-mascot="brand"');
    expect(html).toContain('data-action-plan-mascot="oops"');
    expect(html).toContain("Warum diese Reihenfolge?");
    expect(html).toContain("Gut zu wissen");
    expect(html).not.toContain("Betroffenheitscheck durchführen");
  });

  it("uses the Gap Analysis icon and lower button alignment while the evaluation runs", () => {
    const labels = getDefaultDictionary().modules.actionPlan.workflow;
    const html = renderToStaticMarkup(
      <ActionPlanWorkflow
        organizationId="organization-1"
        current={null}
        preparationState="gap_generating"
        canContribute={false}
        labels={labels}
      />,
    );

    expect(html).toContain('viewBox="0 0 18 10"');
    expect(html).toContain("mt-auto h-12");
    expect(html).toContain("flex w-full flex-1 flex-col");
  });

  it("offers retry after failed generation without discarding the gap result", () => {
    const labels = getDefaultDictionary().modules.actionPlan.workflow;
    const html = renderToStaticMarkup(<ActionPlanWorkflow organizationId="organization-1" current={null} preparationState="failed" availableGapRevisionId="gap-1" canContribute labels={labels} />);
    expect(html).toContain(labels.preparation.failed.title);
    expect(html).toContain("Erneut versuchen");
    expect(html).toContain("/robot-sad.svg");
    expect(html).toContain("Warum diese Reihenfolge?");
    expect(html).toContain("Gut zu wissen");
    expect(html).not.toContain('disabled=""');
  });

  it("uses the logo mascot for the positive no-gaps result", () => {
    const labels = getDefaultDictionary().modules.actionPlan.workflow;
    const html = renderToStaticMarkup(<ActionPlanWorkflow organizationId="organization-1" current={null} preparationState="no_gaps" canContribute={false} labels={labels} />);
    expect(html).toContain('data-action-plan-mascot="brand"');
    expect(html).not.toContain("/robot-sad.svg");
  });
});
