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
    'active_compliance_check_releases',
    'artifact_revision_sources',
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
    'fact_options',
    'generated_artifact_revisions',
    'generated_artifacts',
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
