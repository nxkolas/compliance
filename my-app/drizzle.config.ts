import { config as loadEnvironment } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnvironment({ path: '.env.local', quiet: true });
loadEnvironment({ quiet: true });

const databaseUrl = getDrizzleDatabaseUrl();

if (!databaseUrl) {
  throw new Error('DATABASE_URL or DRIZZLE_DATABASE_URL is required');
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  schemaFilter: 'public',
  tablesFilter: [
    'action_plan_item_gaps',
    'action_plan_items',
    'action_plans',
    'ai_processing_run_context',
    'ai_processing_runs',
    'analysis_output_document_sources',
    'analysis_output_revisions',
    'analysis_outputs',
    'assessment_answers',
    'assessment_revisions',
    'assessments',
    'audit_events',
    'api_rate_limit_windows',
    'background_jobs',
    'document_chunks',
    'document_versions',
    'documents',
    'gap_analysis_cycle_documents',
    'gap_analysis_cycles',
    'gap_finding_context_links',
    'gap_findings',
    'gap_item_context_links',
    'gap_items',
    'guest_applicability_checks',
    'idempotency_records',
    'legal_corpus_families',
    'legal_corpus_snapshot_members',
    'legal_corpus_snapshots',
    'legal_provision_chunk_bindings',
    'legal_source_chunk_embeddings',
    'legal_source_chunks',
    'legal_source_processing_generations',
    'legal_source_renditions',
    'legal_source_versions',
    'legal_sources',
    'organization_invitations',
    'organization_memberships',
    'organizations',
    'platform_audit_events',
    'report_document_sources',
    'reports',
    'upload_sessions',
    'user_profiles',
  ],
  dbCredentials: {
    url: databaseUrl,
  },
});

function getDrizzleDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return toSupabaseSessionPoolerUrl(databaseUrl);
  }

  return process.env.DRIZZLE_DATABASE_URL;
}

function toSupabaseSessionPoolerUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);

  if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '6543') {
    url.port = '5432';
  }

  return url.toString();
}
