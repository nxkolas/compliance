import { and, eq, inArray } from "drizzle-orm";
import { gapFindings } from "@/src/db/schema";
import type { OrganizationScopeExecutor } from "@/src/server/auth/organization-scope";
import { calculateReportMetrics, type ReportMetrics } from "./metrics";

/** Read the revisions pinned to these reports, never the organization's current revision. */
export async function readReportMetrics(
  executor: OrganizationScopeExecutor,
  organizationId: string,
  gapRevisionIds: readonly (string | null)[],
): Promise<Map<string, ReportMetrics | null>> {
  const revisionIds = [...new Set(gapRevisionIds.filter((id): id is string => id !== null))];
  if (!revisionIds.length) return new Map();
  const rows = await executor.select({
    outputRevisionId: gapFindings.outputRevisionId,
    status: gapFindings.status,
    criticality: gapFindings.criticality,
  }).from(gapFindings).where(and(
    eq(gapFindings.organizationId, organizationId),
    inArray(gapFindings.outputRevisionId, revisionIds),
  ));
  const byRevision = new Map<string, typeof rows>();
  for (const row of rows) {
    const findings = byRevision.get(row.outputRevisionId) ?? [];
    findings.push(row);
    byRevision.set(row.outputRevisionId, findings);
  }
  return new Map(revisionIds.map((id) => [id, calculateReportMetrics(byRevision.get(id) ?? [])]));
}
