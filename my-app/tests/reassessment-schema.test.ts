import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  actionPlanItemReconciliations,
  actionPlanReconciliations,
  gapReassessmentDraftDocuments,
  gapReassessmentDrafts,
  gapFindingEvidenceSourceTypeEnum,
  gapRequirements,
  documents,
  aiProcessingRuns,
  artifactRevisionSources,
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

  it("defines the approved page-reader composite indexes in column order", () => {
    const expected = [
      [
        documents,
        "documents_organization_created_idx",
        ["organization_id", "created_at", "id"],
      ],
      [
        gapReassessmentDrafts,
        "gap_reassessment_drafts_organization_assessment_created_idx",
        ["organization_id", "assessment_id", "created_at"],
      ],
      [
        aiProcessingRuns,
        "ai_processing_runs_org_assessment_operation_created_idx",
        [
          "organization_id",
          "assessment_revision_id",
          "operation_kind",
          "created_at",
        ],
      ],
      [
        artifactRevisionSources,
        "artifact_revision_sources_revision_type_idx",
        ["artifact_revision_id", "source_type"],
      ],
    ] as const;

    for (const [table, name, columns] of expected) {
      const index = getTableConfig(table).indexes.find(
        (candidate) => candidate.config.name === name,
      );
      expect(
        index?.config.columns.map((column) =>
          "name" in column ? column.name : undefined,
        ),
      ).toEqual(columns);
    }
  });
});
