import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  actionPlanItemReconciliations,
  actionPlanReconciliations,
  gapReassessmentDraftDocuments,
  gapReassessmentDrafts,
  gapFindingEvidenceSourceTypeEnum,
  gapRequirements,
} from "@/src/db/schema";

describe("reassessment schema", () => {
  it("enables RLS for every new server-only table", () => {
    const tables = [
      gapRequirements,
      gapReassessmentDrafts,
      gapReassessmentDraftDocuments,
      actionPlanReconciliations,
      actionPlanItemReconciliations,
    ];

    for (const table of tables) {
      expect(getTableConfig(table).enableRLS).toBe(true);
    }
  });

  it("links a reassessment to its durable generation job and supports legal citations", () => {
    const config = getTableConfig(gapReassessmentDrafts);
    expect(config.columns.some((column) => column.name === "generation_job_id")).toBe(true);
    expect(gapFindingEvidenceSourceTypeEnum.enumValues).toContain("legal_source_chunk");
  });
});
