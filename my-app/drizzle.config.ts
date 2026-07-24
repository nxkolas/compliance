import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

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
    'action_plan_items',
    'action_plans',
    'active_compliance_check_releases',
    'active_gap_analysis_releases',
    'ai_processing_run_assessment_inputs',
    'ai_processing_run_artifact_inputs',
    'ai_processing_run_document_inputs',
    'ai_processing_runs',
    'artifact_revision_assessment_sources',
    'artifact_revision_artifact_sources',
    'artifact_revision_document_sources',
    'assessment_answer_options',
    'assessment_answers',
    'assessment_revisions',
    'assessments',
    'compliance_check_release_activations',
    'compliance_check_release_content_revisions',
    'compliance_check_release_fact_versions',
    'compliance_check_release_profiles',
    'compliance_check_releases',
    'compliance_framework_versions',
    'compliance_frameworks',
    'compliance_modules',
    'content_items',
    'content_revisions',
    'content_translations',
    'document_chunk_embeddings',
    'document_chunks',
    'document_embedding_generations',
    'document_extractions',
    'document_versions',
    'documents',
    'fact_options',
    'generated_artifact_revisions',
    'generated_artifacts',
    'gap_analysis_release_activations',
    'gap_analysis_release_applicability_rules',
    'gap_analysis_releases',
    'gap_finding_evidence',
    'gap_finding_review_resolutions',
    'gap_findings',
    'gap_reassessment_draft_documents',
    'gap_reassessment_drafts',
    'gap_requirements',
    'gap_requirement_set_members',
    'gap_requirement_set_versions',
    'gap_requirement_sets',
    'gap_requirement_versions',
    'guest_applicability_checks',
    'jurisdiction_entity_type_legal_provisions',
    'jurisdiction_entity_type_mappings',
    'jurisdiction_entity_type_versions',
    'jurisdiction_entity_types',
    'jurisdiction_profile_designations',
    'jurisdiction_profile_effective_states',
    'jurisdiction_profile_jurisdiction_rules',
    'jurisdiction_profile_legal_provisions',
    'jurisdiction_profile_threshold_policies',
    'jurisdiction_profile_versions',
    'jurisdiction_profiles',
    'legal_instrument_versions',
    'legal_instruments',
    'legal_provisions',
    'nis2_result_projections',
    'organization_fact_definitions',
    'organization_fact_definition_versions',
    'organization_fact_value_options',
    'organization_fact_values',
    'organization_invitations',
    'organization_memberships',
    'organizations',
    'question_fact_mappings',
    'question_options',
    'questionnaire_versions',
    'questionnaires',
    'questions',
    'rule_sets',
    'scope_entity_type_legal_provisions',
    'scope_entity_type_versions',
    'scope_entity_types',
    'scope_model_versions',
    'scope_models',
    'scope_sector_versions',
    'scope_sectors',
    'scope_threshold_set_legal_provisions',
    'scope_threshold_sets',
    'audit_events',
    'api_rate_limit_windows',
    'background_jobs',
    'background_job_results',
    'idempotency_records',
    'idempotency_record_results',
    'platform_administrators',
    'platform_audit_events',
    'upload_sessions',
    'upload_session_results',
    'active_legal_corpus_releases',
    'ai_processing_run_claim_context',
    'ai_processing_run_claims',
    'ai_processing_run_context',
    'ai_processing_run_legal_inputs',
    'compliance_check_release_corpus_releases',
    'gap_analysis_release_corpus_releases',
    'legal_corpus_families',
    'legal_corpus_evaluations',
    'legal_corpus_release_activations',
    'legal_corpus_release_members',
    'legal_corpus_releases',
    'legal_source_change_alerts',
    'legal_source_chunk_embeddings',
    'legal_source_chunks',
    'legal_source_monitor_checks',
    'legal_source_monitors',
    'legal_source_processing_generations',
    'legal_source_renditions',
    'legal_source_versions',
    'legal_sources',
    'organization_ai_provider_policies',
    'reports',
    'report_action_plan_sources',
    'report_artifact_sources',
    'report_document_sources',
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
