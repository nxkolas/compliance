import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  apiRateLimitWindows,
  backgroundJobs,
  idempotencyRecords,
  platformAdministrators,
  platformAuditEvents,
  uploadSessions,
  reports,
  reportActionPlanSources,
  reportArtifactSources,
  reportDocumentSources,
  aiProcessingRuns,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
} from "@/src/db/schema";

describe("Phase 1 server-only schema", () => {
  it.each([
    ["api_rate_limit_windows", apiRateLimitWindows],
    ["background_jobs", backgroundJobs],
    ["idempotency_records", idempotencyRecords],
    ["platform_administrators", platformAdministrators],
    ["platform_audit_events", platformAuditEvents],
    ["upload_sessions", uploadSessions],
    ["reports", reports],
    ["report_artifact_sources", reportArtifactSources],
    ["report_action_plan_sources", reportActionPlanSources],
    ["report_document_sources", reportDocumentSources],
  ])("enables RLS for %s", (_name, table) => {
    expect(getTableConfig(table).enableRLS).toBe(true);
  });

  it("requires report output provenance in the schema", () => {
    const config = getTableConfig(reports);
    expect(config.columns.map((column) => column.name)).toContain("output_hash");
    expect(config.checks.map((check) => check.name)).toContain("reports_output_check");
  });

  it("keeps one active cleanup schedule and a recoverable validated AI output", () => {
    expect(getTableConfig(backgroundJobs).indexes.map((index) => index.config.name))
      .toContain("background_jobs_cleanup_active_unique");
    expect(getTableConfig(backgroundJobs).indexes.map((index) => index.config.name))
      .toContain("background_jobs_legal_monitor_active_unique");
    expect(getTableConfig(aiProcessingRuns).columns.map((column) => column.name))
      .toContain("validated_output");
    expect(getTableConfig(aiProcessingRuns).columns.map((column) => column.name))
      .toEqual(expect.arrayContaining([
        "output_locale",
        "attempt_count",
        "language_validation",
      ]));
    expect(getTableConfig(aiProcessingRuns).checks.map((item) => item.name))
      .toEqual(expect.arrayContaining([
        "ai_processing_runs_output_locale_check",
        "ai_processing_runs_attempt_count_check",
        "ai_processing_runs_language_validation_check",
      ]));
  });

  it("enforces legal-rendition and reviewed-generation integrity", () => {
    const rendition = getTableConfig(legalSourceRenditions);
    expect(rendition.foreignKeys.map((foreignKey) => foreignKey.getName()))
      .toContain("legal_source_renditions_authority_version_fk");
    expect(rendition.checks.map((check) => check.name))
      .toContain("legal_source_renditions_translation_check");
    expect(getTableConfig(legalSourceProcessingGenerations).checks.map((check) => check.name))
      .toContain("legal_processing_review_check");
  });
});
