import { describe, expect, it } from "vitest";
import { calculateReportMetrics } from "@/src/server/modules/reports/metrics";

describe("report metrics", () => {
  it("calculates rounded compliance from fully fulfilled findings only", () => {
    expect(calculateReportMetrics([
      ...Array.from({ length: 7 }, () => ({ status: "fulfilled", criticality: "critical" })),
      { status: "partially_fulfilled", criticality: "critical" },
      { status: "not_fulfilled", criticality: "critical" },
      { status: "insufficient_evidence", criticality: "critical" },
      { status: "not_fulfilled", criticality: "high" },
      { status: "partially_fulfilled", criticality: "low" },
    ])).toEqual({ compliancePercent: 58, criticalGapCount: 3 });
  });

  it("does not invent zero or full compliance when there are no findings", () => {
    expect(calculateReportMetrics([])).toBeNull();
  });

  it("handles zero and full compliance without counting fulfilled critical findings as gaps", () => {
    expect(calculateReportMetrics([{ status: "fulfilled", criticality: "critical" }]))
      .toEqual({ compliancePercent: 100, criticalGapCount: 0 });
    expect(calculateReportMetrics([{ status: "partially_fulfilled", criticality: "critical" }]))
      .toEqual({ compliancePercent: 0, criticalGapCount: 1 });
  });
});
