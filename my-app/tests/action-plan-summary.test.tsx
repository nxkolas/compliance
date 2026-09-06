import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionPlanSummary } from "@/components/dashboard/action-plan-summary";
import { dashboardWorkflowMessages } from "@/src/i18n/dashboard-workflow";

function render(statuses: { done: number; inProgress: number; open: number; cancelled: number }, percentage: number) {
  return renderToStaticMarkup(<ActionPlanSummary labels={dashboardWorkflowMessages.de} dashboard={{ plan: {
    id: "plan", sourceUpdatedAt: null, stale: false, outdated: false,
    totalItems: Object.values(statuses).reduce((sum, count) => sum + count, 0),
    openItems: statuses.open + statuses.inProgress, statuses, percentage,
  } }} />);
}

describe("action plan summary", () => {
  it("draws each status from its count independently of the weighted progress", () => {
    const html = render({ done: 2, inProgress: 1, open: 1, cancelled: 0 }, 63);
    expect(html).toContain('aria-label="63% umgesetzt"');
    expect(html).toContain("4 Maßnahmen insgesamt");
    expect(html).toContain("Erledigt (2)");
    expect(html).toContain("In Bearbeitung (1)");
    expect(html).toContain("Offen (1)");
    expect(html).toContain('stroke-dasharray="49.2 50.8"');
    expect(html.match(/data-action-segment=/g)).toHaveLength(3);
  });
  it("renders an empty plan without invalid arcs", () => {
    const html = render({ done: 0, inProgress: 0, open: 0, cancelled: 0 }, 0);
    expect(html).toContain("0 Maßnahmen insgesamt");
    expect(html).not.toContain("data-action-segment");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it("includes cancelled actions as a separate status rather than open or done", () => {
    const html = render({ done: 0, inProgress: 0, open: 0, cancelled: 3 }, 0);
    expect(html).toContain("Abgebrochen (3)");
    expect(html).toContain('data-action-segment="cancelled"');
    expect(html).toContain('stroke-dasharray="100 0"');
    expect(html).not.toContain('data-action-segment="done"');
  });
});
