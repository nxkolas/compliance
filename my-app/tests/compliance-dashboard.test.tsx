import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComplianceDashboard } from "@/components/dashboard/compliance-dashboard";
import { getDictionaryForLocale } from "@/src/i18n";

const source = { sourceUpdatedAt: null, stale: false, outdated: false };
function render(phase: number, openItems = 2) {
  return renderToStaticMarkup(<ComplianceDashboard organizationId="org" locale="de" labels={getDictionaryForLocale("de").modules.dashboard} dashboard={{
    applicability: { ...source, outcome: null, revisionId: phase > 0 ? "check" : null },
    gap: { ...source, revisionId: phase > 1 ? "gap" : null, findingCount: 0, criticalCount: 0 },
    plan: { ...source, id: phase > 1 ? "plan" : null, totalItems: phase > 1 ? 8 : 0, openItems: phase > 1 ? openItems : 0 },
    evidence: { ...source, documentCount: 0, currentVersionCount: 0 },
    report: { ...source, id: null, state: null }, nextSteps: [],
  }} />);
}

describe("compliance dashboard", () => {
  it.each([[0, "Betroffenheitscheck", "Gap-Analyse"], [1, "Gap-Analyse", "Maßnahmenplan"], [2, "Maßnahmenplan", "PDF-Report"]] as const)("shows current and next stages for phase %s with stable library and activity slots", (phase, current, next) => {
    const html = render(phase);
    const currentStart = html.indexOf('data-dashboard-slot="current"');
    const nextStart = html.indexOf('data-dashboard-slot="next"');
    const documentsStart = html.indexOf('data-dashboard-slot="documents"');
    const activityStart = html.indexOf('data-dashboard-slot="activity"');
    expect(html.slice(currentStart, nextStart)).toContain(current);
    expect(html.slice(nextStart, documentsStart)).toContain(next);
    expect(currentStart).toBeLessThan(nextStart);
    expect(nextStart).toBeLessThan(documentsStart);
    expect(documentsStart).toBeLessThan(activityStart);
    expect(html).not.toContain("NaN");
  });
  it("locks the next stage until its prerequisite is completed", () => {
    expect(render(0)).not.toContain('href="/tool/organizations/org/gap-analysis"');
    expect(render(1)).not.toContain('href="/tool/organizations/org/action-plan"');
    expect(render(2)).toContain('href="/tool/organizations/org/action-plan"');
  });
  it("calculates implementation from actual action counts", () => {
    expect(render(2)).toContain('aria-label="75% umgesetzt"');
    expect(render(2, 0)).toContain('aria-label="100% umgesetzt"');
    expect(render(0)).toContain("Noch keine gespeicherten Aktivitäten");
  });
});
