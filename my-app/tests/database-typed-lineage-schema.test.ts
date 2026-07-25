import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  aiProcessingRunArtifactInputs,
  aiProcessingRunAssessmentInputs,
  aiProcessingRunDocumentInputs,
  artifactRevisionArtifactSources,
  artifactRevisionAssessmentSources,
  artifactRevisionDocumentSources,
  backgroundJobResults,
  idempotencyRecordResults,
  reportActionPlanSources,
  reportArtifactSources,
  reportDocumentSources,
  uploadSessionResults,
  backgroundJobs,
  idempotencyRecords,
  uploadSessions,
} from "@/src/db/schema";

function columns(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

function foreignKeyCount(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).foreignKeys.length;
}

describe("database typed workflow lineage", () => {
  it.each([
    [artifactRevisionAssessmentSources, 2],
    [artifactRevisionArtifactSources, 2],
    [artifactRevisionDocumentSources, 2],
    [aiProcessingRunAssessmentInputs, 2],
    [aiProcessingRunArtifactInputs, 2],
    [aiProcessingRunDocumentInputs, 2],
    [reportArtifactSources, 2],
    [reportActionPlanSources, 2],
    [reportDocumentSources, 2],
  ] as const)("gives every source table real target foreign keys", (table, expected) => {
    expect(foreignKeyCount(table)).toBe(expected);
    expect(columns(table)).not.toContain("source_type");
    expect(columns(table)).not.toContain("source_id");
  });

  it.each([
    [backgroundJobs, backgroundJobResults],
    [idempotencyRecords, idempotencyRecordResults],
    [uploadSessions, uploadSessionResults],
  ] as const)("moves generic results out of the workflow row", (owner, results) => {
    expect(columns(owner)).not.toContain("result_type");
    expect(columns(owner)).not.toContain("result_id");
    expect(foreignKeyCount(results)).toBeGreaterThan(1);
    expect(columns(results)).not.toContain("result_type");
    expect(columns(results)).not.toContain("result_id");
  });
});
