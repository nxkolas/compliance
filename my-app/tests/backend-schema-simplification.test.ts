import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  actionPlanItemGaps,
  actionPlanItems,
  actionPlans,
  aiProcessingRuns,
  analysisOutputRevisions,
  apiRateLimitWindows,
  gapFindings,
  gapItems,
  guidanceChunks,
  idempotencyRecords,
  legalCorpusSnapshotMembers,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  organizationModelSettings,
} from "@/src/db/schema";
import { actionPlanItemSchema } from "@/src/contracts/action-plans";

describe("backend schema simplification", () => {
  it("stores Action Plan result text and evidence as separate values", () => {
    const item = {
      id: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      actionPlanId: "00000000-0000-4000-8000-000000000003",
      findingId: "00000000-0000-4000-8000-000000000004",
      title: "Require MFA",
      result: "Privileged accounts require MFA.",
      suggestedEvidence: ["MFA policy", "Configuration export"],
      status: "open" as const,
      position: 0,
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
    };

    expect(actionPlanItemSchema.parse(JSON.parse(JSON.stringify(item)))).toEqual(item);
    expect("description" in actionPlanItems).toBe(false);
    expect(actionPlanItems.suggestedEvidence.notNull).toBe(true);
  });

  it("removes dead and duplicated lineage columns", () => {
    expect("generationAttemptKey" in aiProcessingRuns).toBe(false);
    expect("costAmount" in aiProcessingRuns).toBe(false);
    expect("costCurrency" in aiProcessingRuns).toBe(false);
    expect("errorCode" in idempotencyRecords).toBe(false);
    expect("searchVector" in guidanceChunks).toBe(false);
    expect("id" in organizationModelSettings).toBe(false);
    expect("updatedAt" in apiRateLimitWindows).toBe(false);
    expect("aiProcessingRunId" in analysisOutputRevisions).toBe(false);
    expect("aiProcessingRunId" in actionPlans).toBe(false);
    expect("outputRevisionId" in gapItems).toBe(false);
    expect("actionPlanId" in actionPlanItemGaps).toBe(false);
    expect("originalOutputRevisionId" in gapFindings).toBe(false);
    expect("sourceVersionId" in legalSourceProcessingGenerations).toBe(false);
    expect("sourceVersionId" in legalSourceChunks).toBe(false);
    expect("renditionId" in legalSourceChunks).toBe(false);
    expect("sourceVersionId" in legalCorpusSnapshotMembers).toBe(false);
    expect("renditionId" in legalCorpusSnapshotMembers).toBe(false);
  });

  it("keeps tenant-safe finding and job foreign keys", () => {
    const names = [gapFindings, analysisOutputRevisions, actionPlans, aiProcessingRuns]
      .flatMap((table) => getTableConfig(table).foreignKeys.map((key) => key.getName()));

    expect(names).toEqual(expect.arrayContaining([
      "gap_findings_original_finding_tenant_fk",
      "analysis_output_revisions_generation_job_tenant_fk",
      "action_plans_generation_job_tenant_fk",
      "ai_processing_runs_job_tenant_fk",
    ]));
  });
});
