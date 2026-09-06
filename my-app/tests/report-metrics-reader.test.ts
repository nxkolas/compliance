import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { OrganizationScopeExecutor } from "@/src/server/platform/auth/organization-scope";
import { readReportMetrics } from "@/src/server/modules/reports/metrics-reader";

function mockExecutor(rows: Array<{ outputRevisionId: string; status: string; criticality: string }>) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { executor: { select } as unknown as OrganizationScopeExecutor, select, where };
}

describe("report metrics revision scope", () => {
  it("batches pinned revisions, scopes the query to the organization and keeps results separate", async () => {
    const { executor, select, where } = mockExecutor([
      { outputRevisionId: "old-revision", status: "fulfilled", criticality: "critical" },
      { outputRevisionId: "new-revision", status: "not_fulfilled", criticality: "critical" },
    ]);
    const metrics = await readReportMetrics(executor, "report-organization", [
      "old-revision", "new-revision", "old-revision", null, "missing-revision",
    ]);

    expect(select).toHaveBeenCalledTimes(1);
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain('"gap_findings"."organization_id"');
    expect(query.sql).toContain('"gap_findings"."output_revision_id"');
    expect(query.params).toEqual(["report-organization", "old-revision", "new-revision", "missing-revision"]);
    expect(metrics.get("old-revision")).toEqual({ compliancePercent: 100, criticalGapCount: 0 });
    expect(metrics.get("new-revision")).toEqual({ compliancePercent: 0, criticalGapCount: 1 });
    expect(metrics.get("missing-revision")).toBeNull();
  });

  it("does not query or invent metrics for reports without a Gap revision", async () => {
    const { executor, select } = mockExecutor([]);
    expect(await readReportMetrics(executor, "report-organization", [null])).toEqual(new Map());
    expect(select).not.toHaveBeenCalled();
  });
});
