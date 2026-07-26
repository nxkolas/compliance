import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  gapReassessmentDraftDocuments,
  gapReassessmentDrafts,
  gapFindingEvidenceSourceTypeEnum,
  gapRequirements,
  documents,
  aiProcessingRuns,
  artifactRevisionAssessmentSources,
  actionPlans,
  gapFindings,
  generatedArtifactRevisions,
} from "@/src/db/schema";

describe("reassessment schema", () => {
  it("enables RLS for every new server-only table", () => {
    const tables = [
      gapRequirements,
      gapReassessmentDrafts,
      gapReassessmentDraftDocuments,
    ];

    for (const table of tables) {
      expect(getTableConfig(table).enableRLS).toBe(true);
    }
  });

  it("links a reassessment to its durable generation job and supports legal citations", () => {
    const config = getTableConfig(gapReassessmentDrafts);
    expect(config.columns.some((column) => column.name === "generation_job_id")).toBe(true);
    expect(config.columns.some((column) => column.name === "output_locale")).toBe(true);
    expect(config.checks.map((item) => item.name)).toContain(
      "gap_reassessment_drafts_output_locale_check",
    );
    expect(gapFindingEvidenceSourceTypeEnum.enumValues).toContain("legal_source_chunk");
  });

  it("defines locale boundaries and stores generated finding prose as text", () => {
    const revision = getTableConfig(generatedArtifactRevisions);
    expect(revision.columns.map((column) => column.name)).toContain(
      "output_locale",
    );
    expect(revision.checks.map((item) => item.name)).toContain(
      "generated_artifact_revisions_output_locale_check",
    );

    const plan = getTableConfig(actionPlans);
    expect(
      plan.columns.find((column) => column.name === "output_locale")?.notNull,
    ).toBe(true);
    expect(plan.checks.map((item) => item.name)).toContain(
      "action_plans_output_locale_check",
    );

    const findings = getTableConfig(gapFindings);
    expect(
      findings.columns
        .find((column) => column.name === "review_notice")
        ?.getSQLType(),
    ).toBe("text");
    expect(findings.columns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(["rationale", "recommendation", "objective"]),
    );
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
        artifactRevisionAssessmentSources,
        "artifact_revision_assessment_sources_assessment_idx",
        ["assessment_revision_id"],
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
