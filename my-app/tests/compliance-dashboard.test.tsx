import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComplianceDashboard } from "@/components/dashboard/compliance-dashboard";
import { DashboardActivityFeed } from "@/components/dashboard/dashboard-activity-feed";
import { getDictionaryForLocale } from "@/src/i18n";
import { dashboardWorkflowMessages } from "@/src/i18n/dashboard-workflow";

const source = { sourceUpdatedAt: null, stale: false, outdated: false };
function render(
  phase: number,
  openItems = 2,
  report: {
    id: string | null;
    state: string | null;
    sourceUpdatedAt: string | null;
    stale: boolean;
    outdated: boolean;
    includes: { applicability: boolean; gap: boolean; actionPlan: boolean };
  } = { ...source, id: null, state: null, includes: { applicability: false, gap: false, actionPlan: false } },
) {
  const percentage = phase > 1 ? Math.round((8 - openItems) / 8 * 100) : 0;
  return renderToStaticMarkup(<ComplianceDashboard organizationId="org" locale="de" labels={getDictionaryForLocale("de").modules.dashboard} dashboard={{
    applicability: { ...source, outcome: null, revisionId: phase > 0 ? "check" : null },
    gap: { ...source, revisionId: phase > 1 ? "gap" : null, findingCount: 0, criticalCount: 0, progress: { answered: 0, total: 20, remaining: 20, percentage: 0, updatedAt: null } },
    plan: { ...source, id: phase > 1 ? "plan" : null, totalItems: phase > 1 ? 8 : 0, openItems: phase > 1 ? openItems : 0, statuses: { open: phase > 1 ? openItems : 0, inProgress: 0, done: phase > 1 ? 8 - openItems : 0, cancelled: 0 }, percentage },
    evidence: { ...source, documentCount: 0, currentVersionCount: 0, counts: { total: 0, active: 0, archived: 0 } },
    report, nextSteps: [],
    workflow: { steps: [
      { key: "applicability", status: phase > 0 ? "completed" : "not_started", updatedAt: null },
      { key: "gap_analysis", status: phase > 1 ? "completed" : phase > 0 ? "not_started" : "locked", updatedAt: null },
      { key: "action_plan", status: phase > 1 ? "in_progress" : "locked", updatedAt: null },
    ] },
    recentActivity: [],
    recentActivityNextCursor: null,
    complianceProgress: { currentPercentage: percentage, previousPercentage: 0, delta: percentage, comparisonAt: null, points: [{ at: "2026-09-06T00:00:00.000Z", percentage, applicability: phase > 0 ? 100 : 0, gapAnalysis: phase > 1 ? 100 : 0, actionPlan: percentage }], milestones: [] },
  }} />);
}

describe("compliance dashboard", () => {
  it.each([[0, "Betroffenheitscheck", "Gap-Analyse"], [1, "Gap-Analyse", "Maßnahmenplan"], [2, "Maßnahmenplan", "PDF-Report"]] as const)("shows current and next stages for phase %s with stable library and activity slots", (phase, current, next) => {
    const html = render(phase);
    const currentStart = html.indexOf('data-dashboard-slot="current"');
    const nextStart = html.indexOf('data-dashboard-slot="next"');
    const documentsStart = html.indexOf('data-dashboard-slot="documents"');
    const activityStart = html.indexOf('data-dashboard-slot="activity"');
    expect(html.slice(currentStart, documentsStart)).toContain(current);
    expect(html.slice(nextStart, activityStart)).toContain(next);
    expect(currentStart).toBeLessThan(documentsStart);
    expect(documentsStart).toBeLessThan(nextStart);
    expect(nextStart).toBeLessThan(activityStart);
    expect(html).toContain("order-1 min-w-0");
    expect(html).toContain("order-4 min-w-0");
    expect(html).not.toContain("NaN");
  });
  it("locks the next stage until its prerequisite is completed", () => {
    expect(render(0)).not.toContain('href="/tool/organizations/org/gap-analysis"');
    expect(render(1)).not.toContain('href="/tool/organizations/org/action-plan"');
    expect(render(2)).toContain('href="/tool/organizations/org/action-plan"');
    expect(render(0)).toContain("min-h-24 translate-y-4");
  });
  it("calculates implementation from actual action counts", () => {
    expect(render(2)).toContain('aria-label="75% umgesetzt"');
    expect(render(2)).toContain('data-dashboard-layout="action-plan"');
    expect(render(2)).toContain("75% In Bearbeitung");
    expect(render(2)).toContain('text-[#FFAA00]');
    expect(render(2, 0)).toContain('aria-label="100% umgesetzt"');
    expect(render(0)).toContain("Noch keine gespeicherten Aktivitäten");
  });
  it("uses the compact Figma copy for an unfinished Gap analysis", () => {
    const html = render(1);
    expect(html).toContain('data-dashboard-layout="standard"');
    expect(html).toContain("h-[240px] overflow-hidden");
    expect(html).toContain("Noch 20 von 20 Fragen offen");
    expect(html).toContain("space-y-2 pt-6 text-sm");
    expect(html).toContain("translate-y-6");
    expect(html).not.toContain("20 / 20 Pflichtfragen offen");
    expect(html).not.toContain("Identifizieren Sie Lücken und bewerten Sie Ihre vorhandenen Nachweise.");
  });
  it("shows the compact empty and ready report states", () => {
    const empty = render(2);
    expect(empty).toContain("data-dashboard-report-empty");
    expect(empty).toContain("Noch kein Report erstellt");
    expect(empty).toContain("REPORT ERSTELLEN");
    expect(empty.match(/h-8 w-36/g)?.length).toBeGreaterThanOrEqual(2);
    expect(empty).toContain('data-status-progress="0"');

    const ready = render(2, 2, {
      ...source,
      id: "00000000-0000-4000-8000-000000000010",
      state: "ready",
      sourceUpdatedAt: "2026-09-06T12:00:00.000Z",
      includes: { applicability: true, gap: true, actionPlan: true },
    });
    expect(ready).toContain('data-dashboard-report-state="ready"');
    expect(ready).toContain("Ihr Report ist bereit");
    expect(ready).toContain("REPORT ANSEHEN");
    expect(ready).toContain("Maßnahmen");
    expect(ready).toContain("w-[88px]");
  });
  it("offers another activity page when the aggregate supplies a cursor", () => {
    const labels = dashboardWorkflowMessages.de;
    const html = renderToStaticMarkup(<DashboardActivityFeed
      organizationId="org"
      locale="de"
      initialCursor="next-page"
      initialItems={[{
        id: "00000000-0000-4000-8000-000000000001",
        code: "document_uploaded",
        actor: { userId: null, displayName: "System", initials: "S" },
        occurredAt: "2026-09-06T00:00:00.000Z",
        entityType: "document_version",
        entityId: "version",
        params: { documentTitle: "Policy.pdf" },
        href: null,
      }]}
      labels={{
        empty: labels.empty,
        more: labels.moreActivity,
        loading: labels.loadingActivity,
        loadError: labels.activityLoadError,
        activityText: labels.activityText,
      }}
    />);
    expect(html).toContain("MEHR ANZEIGEN");
    expect(html).toContain("Policy.pdf");
  });
});
