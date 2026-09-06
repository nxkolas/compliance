export type ReportMetrics = {
  compliancePercent: number;
  criticalGapCount: number;
};

type Finding = { status: string; criticality: string };

/** Each finding represents one evaluated requirement; partial is not full compliance. */
export function calculateReportMetrics(findings: readonly Finding[]): ReportMetrics | null {
  if (!findings.length) return null;
  return {
    compliancePercent: Math.round(
      (findings.filter((finding) => finding.status === "fulfilled").length / findings.length) * 100,
    ),
    // Match the dashboard: count critical, unfulfilled findings, not their sub-items.
    criticalGapCount: findings.filter(
      (finding) => finding.criticality === "critical" && finding.status !== "fulfilled",
    ).length,
  };
}
