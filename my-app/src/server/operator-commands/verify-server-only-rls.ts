import "dotenv/config";
import { closeDbConnection, db } from "@/src/db";
import { sql } from "drizzle-orm";

// Kept in step with the same inventory in tests/server-only-rls-schema.test.ts.
// The guidance tables were missing here while present there, so this command
// reported them as unexpected public tables on any database that had them.
const expectedTables = [
  "action_plan_item_gaps", "action_plan_items", "action_plans",
  "ai_processing_run_context", "ai_processing_runs",
  "analysis_output_document_sources", "analysis_output_revisions", "analysis_outputs",
  "api_rate_limit_windows", "assessment_answers", "assessment_revisions", "assessments",
  "audit_events", "background_jobs", "client_inference_requests",
  "document_chunks", "document_versions", "documents",
  "gap_analysis_cycle_documents", "gap_analysis_cycles", "gap_finding_context_links",
  "gap_findings", "gap_item_context_links", "gap_items", "guest_applicability_checks",
  "guidance_chunks", "guidance_provision_bindings", "guidance_sources",
  "idempotency_records", "legal_corpus_families", "legal_corpus_snapshot_members",
  "legal_corpus_snapshots", "legal_provision_chunk_bindings",
  "legal_source_chunks", "legal_source_processing_generations", "legal_source_renditions",
  "legal_source_versions", "legal_sources", "organization_invitations",
  "organization_embedding_migrations", "organization_memberships",
  "organization_model_settings", "organizations", "platform_audit_events",
  "report_document_sources", "reports", "upload_sessions", "user_profiles",
] as const;

async function main() {
  try {
    const tableResult = await db.execute<{ table_name: string; row_security: boolean }>(sql`
      select c.relname as table_name, c.relrowsecurity as row_security
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    const policyResult = await db.execute<{ table_name: string; policy_name: string }>(sql`
      select tablename as table_name, policyname as policy_name
      from pg_policies where schemaname = 'public'
      order by tablename, policyname
    `);
    const triggerResult = await db.execute<{ trigger_name: string }>(sql`
      select tgname as trigger_name
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal
        and tgname in ('audit_events_append_only', 'platform_audit_events_append_only')
    `);

    const tables = Array.from(tableResult);
    const tableNames = new Set(tables.map((row) => row.table_name));
    const triggerNames = new Set(Array.from(triggerResult).map((row) => row.trigger_name));
    const failures = [
      ...expectedTables.flatMap((table) => tableNames.has(table) ? [] : [`${table}: missing`]),
      ...tables.flatMap((row) => row.row_security ? [] : [`${row.table_name}: RLS disabled`]),
      ...tables.flatMap((row) => (expectedTables as readonly string[]).includes(row.table_name) ? [] : [`${row.table_name}: unexpected public table`]),
      ...Array.from(policyResult).map((row) => `${row.table_name}: unexpected browser policy ${row.policy_name}`),
      ...["audit_events_append_only", "platform_audit_events_append_only"].flatMap((trigger) => triggerNames.has(trigger) ? [] : [`${trigger}: missing`]),
    ];
    if (failures.length) throw new Error(`Server-only RLS verification failed:\n${failures.join("\n")}`);
    console.log(`Verified ${tables.length} public tables: exact target inventory, RLS enabled, default-deny policies, and append-only audit triggers.`);
  } finally {
    await closeDbConnection();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
