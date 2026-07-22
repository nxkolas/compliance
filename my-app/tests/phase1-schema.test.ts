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
  reportSources,
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
    ["report_sources", reportSources],
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
