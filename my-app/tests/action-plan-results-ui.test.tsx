import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActionPlanWorkflow } from "@/components/action-plans/action-plan-workflow";
import { getDefaultDictionary } from "@/src/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const labels = getDefaultDictionary().modules.actionPlan.workflow;

describe("action plan result presentation", () => {
  it("renders dynamic status totals and real actions in the Figma layout", () => {
    const html = renderToStaticMarkup(
      <ActionPlanWorkflow
        organizationId="organization-1"
        current={currentPlanFixture() as never}
        canContribute
        labels={labels}
      />,
    );

    expect(html).toContain("data-action-plan-results");
    expect(html).toContain("data-action-plan-status-summary");
    expectStatusCount(html, "all", 4);
    expectStatusCount(html, "open", 2);
    expectStatusCount(html, "in_progress", 1);
    expectStatusCount(html, "done", 0);
    expectStatusCount(html, "cancelled", 1);
    expect(html.match(/data-action-plan-item=/g)).toHaveLength(4);
    expect(html.match(/data-action-plan-item-expanded=/g)).toHaveLength(1);
    expect(html).toContain('aria-expanded="true"');
    expect(
      html.match(
        /<button type="button" aria-expanded="false" class="flex w-full items-center/g,
      ),
    ).toHaveLength(3);
    expect(html).toContain("Check IT security ownership");
    expect(html).toContain("Responsibility and organization");
    expect(html).toContain("Name an accountable security owner.");
    expect(html).toContain("Security organization chart");
    expect(html).toContain(labels.whatToDo);
    expect(html).toContain(labels.evidenceToCreate);
    expect(html).toContain("bg-[#002BFF]");
    expect(html).not.toContain(labels.resultLanguage);
  });

  it("preserves contribution restrictions in the result controls", () => {
    const html = renderToStaticMarkup(
      <ActionPlanWorkflow
        organizationId="organization-1"
        current={currentPlanFixture() as never}
        canContribute={false}
        labels={labels}
      />,
    );

    expect(html).toMatch(/<button[^>]*role="combobox"[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Änderungen speichern/);
  });
});

function expectStatusCount(html: string, status: string, count: number) {
  expect(html).toMatch(
    new RegExp(
      `data-action-plan-status-card="${status}"[^>]*>[\\s\\S]*?>${count}</span>`,
    ),
  );
}

function currentPlanFixture() {
  const action = (
    id: string,
    title: string,
    status: "open" | "in_progress" | "done" | "cancelled",
    result: string,
    suggestedEvidence: string[],
  ) => ({
    id,
    title,
    status,
    result,
    suggestedEvidence,
    priority: "high",
  });

  return {
    plan: { id: "plan-1", locale: "de" },
    sourceStaleness: { stale: false },
    categories: [
      {
        requirementVersionId: "requirement-1",
        title: "Responsibility and organization",
        icon: "Building2",
        actions: [
          action(
            "item-1",
            "Check IT security ownership",
            "open",
            "Name an accountable security owner.",
            ["Security organization chart", "Responsibility matrix"],
          ),
          action(
            "item-2",
            "Clarify management oversight",
            "open",
            "Document management oversight.",
            ["Management minutes"],
          ),
        ],
      },
      {
        requirementVersionId: "requirement-2",
        title: "Access and personnel",
        icon: "KeyRound",
        actions: [
          action(
            "item-3",
            "Document incident reporting",
            "in_progress",
            "Document the reporting workflow.",
            ["Reporting procedure"],
          ),
          action(
            "item-4",
            "Retire obsolete access",
            "cancelled",
            "Record the cancellation decision.",
            ["Decision record"],
          ),
        ],
      },
    ],
  };
}
