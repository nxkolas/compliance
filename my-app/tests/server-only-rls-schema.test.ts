import { getTableName, is, Table } from "drizzle-orm";
import { type AnyPgTable, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";

const expectedTables = [
  "action_plan_item_gaps", "action_plan_items", "action_plans",
  "ai_processing_run_context", "ai_processing_runs",
  "analysis_output_document_sources", "analysis_output_revisions", "analysis_outputs",
  "api_rate_limit_windows", "assessment_answers", "assessment_revisions", "assessments", "audit_events",
  "background_jobs", "client_inference_requests",
  "document_chunks", "document_versions", "documents",
  "gap_analysis_cycle_documents", "gap_analysis_cycles", "gap_finding_context_links", "gap_findings",
  "gap_item_context_links", "gap_items", "guest_applicability_checks",
  "guidance_chunks", "guidance_provision_bindings", "guidance_sources",
  "idempotency_records",
  "legal_corpus_families", "legal_corpus_snapshot_members", "legal_corpus_snapshots",
  "legal_provision_chunk_bindings", "legal_source_chunks",
  "legal_source_processing_generations", "legal_source_renditions", "legal_source_versions", "legal_sources",
  "organization_embedding_migrations", "organization_invitations",
  "organization_memberships", "organization_model_settings",
  "organizations", "platform_audit_events",
  "report_document_sources", "reports", "upload_sessions", "user_profiles",
].sort();

describe("target database architecture", () => {
  it("contains exactly the intended tables with default-deny RLS", () => {
    const schemaValues: unknown[] = Object.values(schema);
    const tables = schemaValues
      .filter((value): value is AnyPgTable => is(value, Table))
      .sort((left, right) => getTableName(left).localeCompare(getTableName(right)));
    expect(tables.map(getTableName)).toEqual(expectedTables);
    for (const table of tables) {
      const config = getTableConfig(table);
      expect(config.enableRLS, `${getTableName(table)} must enable RLS`).toBe(true);
      expect(config.policies, `${getTableName(table)} must remain browser-inaccessible`).toEqual([]);
    }
  });

  it("does not expose retired control-plane tables", () => {
    const serialized = expectedTables.join("\n");
    for (const forbidden of [
      "generated_artifacts", "rule_sets", "questionnaires", "gap_requirements",
      "active_compliance_check_releases", "active_gap_analysis_releases", "platform_administrators",
      "legal_corpus_releases", "legal_source_monitors", "background_job_results",
    ]) expect(serialized).not.toContain(forbidden);
  });
});
