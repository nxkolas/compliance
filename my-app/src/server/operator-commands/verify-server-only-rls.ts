import "dotenv/config";
import { closeDbConnection, db } from "@/src/db";
import { sql } from "drizzle-orm";

const expectedTables = [
  "api_rate_limit_windows",
  "background_jobs",
  "background_job_results",
  "idempotency_records",
  "idempotency_record_results",
  "platform_administrators",
  "platform_audit_events",
  "upload_sessions",
  "upload_session_results",
  "user_directory",
  "active_legal_corpus_releases",
  "ai_processing_run_claim_context",
  "ai_processing_run_claims",
  "ai_processing_run_context",
  "ai_processing_run_legal_inputs",
  "compliance_check_release_corpus_releases",
  "gap_analysis_release_corpus_releases",
  "gap_reassessment_draft_documents",
  "gap_reassessment_drafts",
  "gap_requirements",
  "legal_corpus_families",
  "legal_corpus_evaluations",
  "legal_corpus_release_activations",
  "legal_corpus_release_members",
  "legal_corpus_releases",
  "legal_source_change_alerts",
  "legal_source_chunk_embeddings",
  "legal_source_chunks",
  "legal_source_monitor_checks",
  "legal_source_monitors",
  "legal_source_processing_generations",
  "legal_source_renditions",
  "legal_source_versions",
  "legal_sources",
  "organization_ai_provider_policies",
  "reports",
  "report_artifact_sources",
  "report_action_plan_sources",
  "report_document_sources",
  "artifact_revision_assessment_sources",
  "artifact_revision_artifact_sources",
  "artifact_revision_document_sources",
  "ai_processing_run_assessment_inputs",
  "ai_processing_run_artifact_inputs",
  "ai_processing_run_document_inputs",
];

async function main() {
  const allTableResult = await db.execute<{
    table_name: string;
    row_security: boolean;
  }>(sql`
    select
      c.relname as table_name,
      c.relrowsecurity as row_security
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);
  const result = await db.execute<{
    table_name: string;
    row_security: boolean;
  }>(sql`
    select
      c.relname as table_name,
      c.relrowsecurity as row_security
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (${sql.join(expectedTables.map((table) => sql`${table}`), sql`, `)})
    order by c.relname
  `);

  const rows = Array.from(result);
  const policyResult = await db.execute<{
    table_name: string;
    policy_name: string;
  }>(sql`
    select
      tablename as table_name,
      policyname as policy_name
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `);
  const triggerResult = await db.execute<{ trigger_name: string }>(sql`
    select tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and tgname in (
        'audit_events_append_only',
        'platform_audit_events_append_only',
        'legal_source_rendition_authority_integrity',
        'legal_processing_review_complete'
      )
  `);
  const corpusConstraintResult = await db.execute<{ constraint_name: string }>(sql`
    select conname as constraint_name
    from pg_constraint
    where conrelid in (
      'public.legal_source_renditions'::regclass,
      'public.legal_source_processing_generations'::regclass
    )
      and conname in (
        'legal_source_renditions_translation_check',
        'legal_source_renditions_authority_version_fk',
        'legal_processing_review_check'
      )
  `);
  const schedulerIndexResult = await db.execute<{ index_name: string }>(sql`
    select indexname as index_name
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'background_jobs_cleanup_active_unique',
        'background_jobs_legal_monitor_active_unique'
      )
  `);
  const triggerNames = new Set(Array.from(triggerResult).map((row) => row.trigger_name));
  const corpusConstraintNames = new Set(
    Array.from(corpusConstraintResult).map((row) => row.constraint_name),
  );
  const schedulerIndexNames = new Set(
    Array.from(schedulerIndexResult).map((row) => row.index_name),
  );
  const allTables = Array.from(allTableResult);
  const failures = allTables.flatMap((row) =>
    row.row_security ? [] : [`${row.table_name}: RLS disabled`],
  );
  failures.push(
    ...Array.from(policyResult).map(
      (row) => `${row.table_name}: unexpected RLS policy ${row.policy_name}`,
    ),
  );
  failures.push(...expectedTables.flatMap((table) => {
    const row = rows.find((candidate) => candidate.table_name === table);
    if (!row) return [`${table}: missing`];
    return [];
  }));
  for (const trigger of [
    "audit_events_append_only",
    "platform_audit_events_append_only",
    "legal_source_rendition_authority_integrity",
    "legal_processing_review_complete",
  ]) {
    if (!triggerNames.has(trigger)) failures.push(`${trigger}: missing`);
  }
  for (const constraint of [
    "legal_source_renditions_translation_check",
    "legal_source_renditions_authority_version_fk",
    "legal_processing_review_check",
  ]) {
    if (!corpusConstraintNames.has(constraint)) failures.push(`${constraint}: missing`);
  }
  for (const index of [
    "background_jobs_cleanup_active_unique",
    "background_jobs_legal_monitor_active_unique",
  ]) {
    if (!schedulerIndexNames.has(index)) failures.push(`${index}: missing`);
  }
  if (failures.length > 0) {
    throw new Error(`Server-only RLS verification failed:\n${failures.join("\n")}`);
  }
  console.log(
    `Verified default-deny RLS on all ${allTables.length} public tables, ${rows.length} rollout tables, 2 append-only audit triggers, durable schedulers, and legal-corpus review integrity.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
