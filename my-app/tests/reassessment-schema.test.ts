import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  actionPlanItemReconciliations,
  actionPlanReconciliations,
  gapReassessmentDraftDocuments,
  gapReassessmentDrafts,
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
});
