import type { Dictionary } from "@/src/i18n";

type DashboardLabels = Dictionary["modules"]["dashboard"];

type DashboardData = {
  applicability: { outcome: string | null };
  gap: { findingCount: number; criticalCount: number };
  evidence: { currentVersionCount: number };
  plan: { openItems: number; totalItems: number };
  report: { state: string | null };
  nextSteps: string[];
};

export function buildDashboardPresentation(
  dashboard: DashboardData,
  labels: DashboardLabels,
) {
  const overview = labels.overview;
  const outcome = mappedValue(
    overview.outcomes,
    dashboard.applicability.outcome,
    overview.pending,
  );
  const reportState = mappedValue(
    overview.reportStates,
    dashboard.report.state,
    overview.notCreated,
  );
  const nextSteps = dashboard.nextSteps.length
    ? dashboard.nextSteps.map((step) =>
        mappedValue(overview.nextStepLabels, step, overview.noOpenNextSteps),
      )
    : [overview.noOpenNextSteps];

  return {
    metrics: [
      { label: overview.applicabilityStatus, value: outcome },
      { label: overview.openActions, value: String(dashboard.plan.openItems) },
      {
        label: overview.criticalFindings,
        value: String(dashboard.gap.criticalCount),
      },
    ],
    cards: [
      {
        title: overview.currentData,
        items: [
          `${overview.findings}: ${dashboard.gap.findingCount}`,
          `${overview.documentVersions}: ${dashboard.evidence.currentVersionCount}`,
          `${overview.actions}: ${dashboard.plan.totalItems}`,
          `${overview.report}: ${reportState}`,
        ],
      },
      { title: overview.nextSteps, items: nextSteps },
    ],
  };
}

function mappedValue(
  mapping: Readonly<Record<string, string>>,
  code: string | null,
  fallback: string,
) {
  return code ? mapping[code] ?? fallback : fallback;
}
